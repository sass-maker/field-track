package com.fieldtrack.employee.tracking

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.URL
import java.util.concurrent.Executors
import javax.net.ssl.HttpsURLConnection

internal object PointUploader {
  private val executor = Executors.newSingleThreadExecutor()

  fun uploadAsync(context: Context) {
    val app = context.applicationContext
    executor.execute { uploadAvailable(app) }
  }

  private fun uploadAvailable(context: Context) {
    val baseUrl = TrackingPreferences.apiBaseUrl(context) ?: return
    val token = TrackingPreferences.deviceToken(context) ?: return
    val employeeId = TrackingPreferences.employeeId(context) ?: return
    val deviceId = TrackingPreferences.deviceId(context) ?: return
    val queue = LocationQueue(context)

    repeat(8) {
      val points = queue.oldest()
      if (points.isEmpty()) return
      val body = JSONObject()
        .put("employeeId", employeeId)
        .put("deviceId", deviceId)
        .put("sim", SimInfoReader.selected(context).json())
        .put("points", JSONArray(points))
      val connection = URL("$baseUrl/api/locations/batch").openConnection() as HttpsURLConnection
      try {
        connection.requestMethod = "POST"
        connection.connectTimeout = 15_000
        connection.readTimeout = 20_000
        connection.doOutput = true
        connection.setRequestProperty("content-type", "application/json")
        connection.setRequestProperty("authorization", "Bearer $token")
        connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
        if (connection.responseCode !in 200..299) return
        val response = connection.inputStream.bufferedReader().use { it.readText() }
        val payload = JSONObject(response)
        val accepted = payload.getJSONArray("acceptedIds")
        val ids = (0 until accepted.length()).map { accepted.getString(it) }
        queue.remove(ids)
        payload.optString("policyId").takeIf { it.isNotBlank() }?.let { TrackingPreferences.setPolicyId(context, it) }
        TrackingPreferences.setLastUploadedAt(context, isoUtc())
        if (ids.isEmpty()) return
      } catch (_: Exception) {
        return
      } finally { connection.disconnect() }
    }
  }
}
