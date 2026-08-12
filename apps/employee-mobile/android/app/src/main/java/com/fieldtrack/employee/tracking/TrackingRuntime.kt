package com.fieldtrack.employee.tracking

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

internal object TrackingRuntime {
  fun hasLocationPermission(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

  fun startIfEnrolled(context: Context): Boolean {
    if (!TrackingPreferences.enrolled(context) || !hasLocationPermission(context)) return false
    return try {
      val intent = Intent(context, LocationTrackingService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
      true
    } catch (_: RuntimeException) {
      false
    }
  }
}
