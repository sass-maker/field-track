package com.fieldtrack.employee

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.fieldtrack.employee.tracking.TrackingRuntime

class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "FieldTrackEmployee"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    TrackingRuntime.startIfEnrolled(this)
  }
}
