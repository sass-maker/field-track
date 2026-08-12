package com.fieldtrack.employee

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.loadReactNative
import com.fieldtrack.employee.tracking.FieldTrackingPackage
import com.fieldtrack.employee.tracking.TrackingRuntime

class MainApplication : Application(), ReactApplication {
  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList = PackageList(this).packages.apply { add(FieldTrackingPackage()) },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    TrackingRuntime.startIfEnrolled(this)
  }
}
