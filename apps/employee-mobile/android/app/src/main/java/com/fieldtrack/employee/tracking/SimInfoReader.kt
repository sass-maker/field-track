package com.fieldtrack.employee.tracking

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import org.json.JSONObject

internal data class SimSnapshot(
  val subscriptionId: Int,
  val slotIndex: Int,
  val displayName: String?,
  val carrierName: String?,
  val phoneNumber: String?,
  val countryIso: String?,
  val mccMnc: String?,
  val present: Boolean,
) {
  fun writableMap(): WritableMap = Arguments.createMap().apply {
    putInt("subscriptionId", subscriptionId)
    putInt("slotIndex", slotIndex)
    putString("displayName", displayName)
    putString("carrierName", carrierName)
    putString("phoneNumber", phoneNumber)
    putString("countryIso", countryIso)
    putString("mccMnc", mccMnc)
    putBoolean("present", present)
  }

  fun json(): JSONObject = JSONObject()
    .put("subscriptionId", subscriptionId)
    .put("slotIndex", slotIndex)
    .put("displayName", displayName)
    .put("carrierName", carrierName)
    .put("phoneNumber", phoneNumber)
    .put("countryIso", countryIso)
    .put("mccMnc", mccMnc)
    .put("present", present)
}

internal object SimInfoReader {
  private fun permitted(context: Context) =
    context.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED

  private fun phoneNumber(context: Context, manager: SubscriptionManager, info: SubscriptionInfo): String? {
    val canReadNumber = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
      context.checkSelfPermission(Manifest.permission.READ_PHONE_NUMBERS) == PackageManager.PERMISSION_GRANTED
    if (!canReadNumber) return null
    return try {
      val value = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) manager.getPhoneNumber(info.subscriptionId) else info.number
      value?.trim()?.takeIf { it.isNotBlank() }
    } catch (_: SecurityException) { null }
  }

  private fun snapshot(context: Context, manager: SubscriptionManager, info: SubscriptionInfo) = SimSnapshot(
    subscriptionId = info.subscriptionId,
    slotIndex = info.simSlotIndex,
    displayName = info.displayName?.toString()?.takeIf { it.isNotBlank() },
    carrierName = info.carrierName?.toString()?.takeIf { it.isNotBlank() },
    phoneNumber = phoneNumber(context, manager, info),
    countryIso = info.countryIso?.takeIf { it.isNotBlank() },
    mccMnc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      listOfNotNull(info.mccString, info.mncString).joinToString("").takeIf { it.isNotBlank() }
    } else null,
    present = true,
  )

  fun active(context: Context): List<SimSnapshot> {
    if (!permitted(context)) return emptyList()
    val manager = context.getSystemService(SubscriptionManager::class.java)
    return try { manager.activeSubscriptionInfoList.orEmpty().map { snapshot(context, manager, it) }.sortedBy { it.slotIndex } }
    catch (_: SecurityException) { emptyList() }
  }

  fun writableArray(context: Context): WritableArray = Arguments.createArray().apply {
    active(context).forEach { pushMap(it.writableMap()) }
  }

  fun selected(context: Context): SimSnapshot {
    val selectedId = TrackingPreferences.simSubscriptionId(context)
    val selectedSlot = TrackingPreferences.simSlotIndex(context)
    val active = active(context)
    val current = active.firstOrNull { it.subscriptionId == selectedId }
      ?: active.firstOrNull { it.slotIndex == selectedSlot }
    return current ?: SimSnapshot(
      subscriptionId = selectedId,
      slotIndex = selectedSlot,
      displayName = TrackingPreferences.simDisplayName(context),
      carrierName = TrackingPreferences.simCarrierName(context),
      phoneNumber = TrackingPreferences.simPhoneNumber(context),
      countryIso = TrackingPreferences.simCountryIso(context),
      mccMnc = TrackingPreferences.simMccMnc(context),
      present = false,
    )
  }
}
