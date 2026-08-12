package com.fieldtrack.employee.tracking

import android.content.Context
import java.util.UUID

internal object TrackingPreferences {
  private const val NAME = "field_track_enrollment"
  private fun store(context: Context) = context.getSharedPreferences(NAME, Context.MODE_PRIVATE)

  fun save(
    context: Context,
    employeeId: String,
    employeeName: String,
    deviceId: String,
    deviceToken: String,
    policyId: String,
    apiBaseUrl: String,
    simSubscriptionId: Int,
    simSlotIndex: Int,
    simDisplayName: String?,
    simCarrierName: String?,
    simPhoneNumber: String?,
    simCountryIso: String?,
    simMccMnc: String?,
  ) {
    store(context).edit()
      .putString("employee_id", employeeId)
      .putString("employee_name", employeeName)
      .putString("device_id", deviceId)
      .putString("device_token", deviceToken)
      .putString("policy_id", policyId)
      .putString("api_base_url", apiBaseUrl.trimEnd('/'))
      .putInt("sim_subscription_id", simSubscriptionId)
      .putInt("sim_slot_index", simSlotIndex)
      .putString("sim_display_name", simDisplayName)
      .putString("sim_carrier_name", simCarrierName)
      .putString("sim_phone_number", simPhoneNumber)
      .putString("sim_country_iso", simCountryIso)
      .putString("sim_mcc_mnc", simMccMnc)
      .apply()
  }

  fun installId(context: Context): String {
    val existing = store(context).getString("install_id", null)
    if (!existing.isNullOrBlank()) return existing
    val created = "android-${UUID.randomUUID()}"
    store(context).edit().putString("install_id", created).apply()
    return created
  }

  fun enrolled(context: Context) = !employeeId(context).isNullOrBlank() && !deviceToken(context).isNullOrBlank()
  fun employeeId(context: Context) = store(context).getString("employee_id", null)
  fun employeeName(context: Context) = store(context).getString("employee_name", null)
  fun deviceId(context: Context) = store(context).getString("device_id", null)
  fun deviceToken(context: Context) = store(context).getString("device_token", null)
  fun policyId(context: Context) = store(context).getString("policy_id", null)
  fun apiBaseUrl(context: Context) = store(context).getString("api_base_url", null)
  fun simSubscriptionId(context: Context) = store(context).getInt("sim_subscription_id", -1)
  fun simSlotIndex(context: Context) = store(context).getInt("sim_slot_index", -1)
  fun simDisplayName(context: Context) = store(context).getString("sim_display_name", null)
  fun simCarrierName(context: Context) = store(context).getString("sim_carrier_name", null)
  fun simPhoneNumber(context: Context) = store(context).getString("sim_phone_number", null)
  fun simCountryIso(context: Context) = store(context).getString("sim_country_iso", null)
  fun simMccMnc(context: Context) = store(context).getString("sim_mcc_mnc", null)
  fun lastRecordedAt(context: Context) = store(context).getString("last_recorded_at", null)
  fun lastUploadedAt(context: Context) = store(context).getString("last_uploaded_at", null)
  fun setLastRecordedAt(context: Context, value: String) = store(context).edit().putString("last_recorded_at", value).apply()
  fun setLastUploadedAt(context: Context, value: String) = store(context).edit().putString("last_uploaded_at", value).apply()
  fun setPolicyId(context: Context, value: String) = store(context).edit().putString("policy_id", value).apply()
}
