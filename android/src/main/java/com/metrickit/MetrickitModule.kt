package com.metrickit

import com.facebook.react.bridge.ReactApplicationContext

class MetrickitModule(reactContext: ReactApplicationContext) :
  NativeMetrickitSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeMetrickitSpec.NAME
  }
}
