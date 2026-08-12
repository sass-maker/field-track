package com.fieldtrack.employee.tracking

import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.ReactPackage

class FieldTrackingModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "FieldTracking"

  @ReactMethod
  fun configure(enrollment: ReadableMap, promise: Promise) {
    try {
      val selectedSim = enrollment.getMap("selectedSim") ?: error("selectedSim is required")
      TrackingPreferences.save(
        context,
        enrollment.getString("employeeId") ?: error("employeeId is required"),
        enrollment.getString("employeeName") ?: "Assigned employee",
        enrollment.getString("deviceId") ?: error("deviceId is required"),
        enrollment.getString("deviceToken") ?: error("deviceToken is required"),
        enrollment.getString("policyId") ?: error("policyId is required"),
        enrollment.getString("apiBaseUrl") ?: error("apiBaseUrl is required"),
        selectedSim.getInt("subscriptionId"),
        selectedSim.getInt("slotIndex"),
        selectedSim.getString("displayName"),
        selectedSim.getString("carrierName"),
        selectedSim.getString("phoneNumber"),
        selectedSim.getString("countryIso"),
        selectedSim.getString("mccMnc"),
      )
      promise.resolve(null)
    } catch (error: Exception) { promise.reject("ENROLLMENT_INVALID", error.message, error) }
  }

  @ReactMethod
  fun getInstallId(promise: Promise) = promise.resolve(TrackingPreferences.installId(context))

  @ReactMethod
  fun getActiveSims(promise: Promise) = promise.resolve(SimInfoReader.writableArray(context))

  @ReactMethod
  fun start(promise: Promise) {
    if (!TrackingRuntime.hasLocationPermission(context)) return promise.reject("LOCATION_PERMISSION", "Precise location permission is required")
    if (TrackingRuntime.startIfEnrolled(context)) promise.resolve(null)
    else promise.reject("SERVICE_START", "Android did not allow the tracking service to start")
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    val status = WritableNativeMap().apply {
      putBoolean("enrolled", TrackingPreferences.enrolled(context))
      putString("employeeName", TrackingPreferences.employeeName(context))
      putString("deviceId", TrackingPreferences.deviceId(context))
      putString("policyId", TrackingPreferences.policyId(context))
      putString("simCarrierName", TrackingPreferences.simCarrierName(context))
      putInt("simSlotIndex", TrackingPreferences.simSlotIndex(context))
      putBoolean("simPresent", if (TrackingPreferences.enrolled(context)) SimInfoReader.selected(context).present else false)
      putInt("queuedPoints", LocationQueue(context).count())
      putString("lastRecordedAt", TrackingPreferences.lastRecordedAt(context))
      putString("lastUploadedAt", TrackingPreferences.lastUploadedAt(context))
      putBoolean("serviceConfigured", TrackingRuntime.hasLocationPermission(context) && TrackingPreferences.enrolled(context))
    }
    promise.resolve(status)
  }
}

class FieldTrackingPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = listOf(FieldTrackingModule(reactContext))
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
