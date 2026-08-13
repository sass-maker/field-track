package com.fieldtrack.employee.tracking

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.net.ConnectivityManager
import android.net.Network
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.fieldtrack.employee.MainActivity
import com.fieldtrack.employee.R
import com.google.android.gms.location.CurrentLocationRequest
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import org.json.JSONObject
import java.util.UUID

class LocationTrackingService : Service() {
  private lateinit var locationClient: FusedLocationProviderClient
  private lateinit var connectivity: ConnectivityManager
  private var stationaryUpdates = 0
  private var stationaryMode = false
  private var lastHighAccuracyAt = 0L

  private val locationCallback = object : LocationCallback() {
    override fun onLocationResult(result: LocationResult) {
      result.locations.forEach(::recordLocation)
    }
  }

  private val networkCallback = object : ConnectivityManager.NetworkCallback() {
    override fun onAvailable(network: Network) { PointUploader.uploadAsync(this@LocationTrackingService) }
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    val notification = trackingNotification("Starting location tracking…")
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
    } else startForeground(NOTIFICATION_ID, notification)
    locationClient = LocationServices.getFusedLocationProviderClient(this)
    connectivity = getSystemService(ConnectivityManager::class.java)
    connectivity.registerDefaultNetworkCallback(networkCallback)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (!TrackingPreferences.enrolled(this) || !TrackingRuntime.hasLocationPermission(this)) {
      stopSelf()
      return START_NOT_STICKY
    }
    requestUpdates(stationary = false)
    PointUploader.uploadAsync(this)
    return START_STICKY
  }

  private fun requestUpdates(stationary: Boolean) {
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return
    locationClient.removeLocationUpdates(locationCallback)
    val interval = if (stationary) 4 * 60_000L else 60_000L
    val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, interval)
      .setMinUpdateIntervalMillis(if (stationary) 3 * 60_000L else 45_000L)
      .setMaxUpdateDelayMillis(interval * 2)
      .setMinUpdateDistanceMeters(if (stationary) 50f else 25f)
      .build()
    locationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
    stationaryMode = stationary
  }

  private fun recordLocation(location: Location) {
    val recordedAt = isoUtc(location.time)
    val point = JSONObject()
      .put("id", UUID.randomUUID().toString())
      .put("employeeId", TrackingPreferences.employeeId(this))
      .put("deviceId", TrackingPreferences.deviceId(this))
      .put("latitude", location.latitude)
      .put("longitude", location.longitude)
      .put("accuracyMeters", location.accuracy.toDouble())
      .put("recordedAt", recordedAt)
      .put("batteryPercentage", batteryPercentage())
      .put("source", "android")
      .put("policyId", TrackingPreferences.policyId(this))
    LocationQueue(this).enqueue(point)
    TrackingPreferences.setLastRecordedAt(this, recordedAt)
    getSystemService(NotificationManager::class.java).notify(
      NOTIFICATION_ID,
      trackingNotification("Last location ${recordedAt.substring(11, 16)} · ${LocationQueue(this).count()} saved"),
    )
    PointUploader.uploadAsync(this)

    stationaryUpdates = if (location.hasSpeed() && location.speed < 0.5f) stationaryUpdates + 1 else 0
    if (!stationaryMode && stationaryUpdates >= 3) requestUpdates(stationary = true)
    if (stationaryMode && location.hasSpeed() && location.speed >= 0.8f) {
      stationaryUpdates = 0
      requestUpdates(stationary = false)
    }
    if (location.accuracy > 100f && System.currentTimeMillis() - lastHighAccuracyAt > 5 * 60_000L) requestHighAccuracyFix()
  }

  private fun requestHighAccuracyFix() {
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return
    lastHighAccuracyAt = System.currentTimeMillis()
    val request = CurrentLocationRequest.Builder()
      .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
      .setDurationMillis(20_000)
      .setMaxUpdateAgeMillis(0)
      .build()
    locationClient.getCurrentLocation(request, CancellationTokenSource().token)
      .addOnSuccessListener { location -> if (location != null) recordLocation(location) }
  }

  private fun batteryPercentage(): Any {
    val status = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) ?: return -1
    val level = status.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
    val scale = status.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
    return if (level >= 0 && scale > 0) ((level * 100f) / scale).toInt() else JSONObject.NULL
  }

  private fun trackingNotification(content: String): Notification {
    val openApp = PendingIntent.getActivity(
      this, 0, Intent(this, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle("Field Track is reporting location")
      .setContentText(content)
      .setContentIntent(openApp)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(CHANNEL_ID, "Location tracking", NotificationManager.IMPORTANCE_LOW).apply {
      description = "Required while this managed device reports field location"
      setShowBadge(false)
    }
    getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    TrackingRuntime.startIfEnrolled(applicationContext)
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    locationClient.removeLocationUpdates(locationCallback)
    runCatching { connectivity.unregisterNetworkCallback(networkCallback) }
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private companion object {
    const val CHANNEL_ID = "field_track_location"
    const val NOTIFICATION_ID = 4201
  }
}
