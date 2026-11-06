package com.fracspace.tooka

import android.content.Intent
import android.os.Build
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.fracspace.tooka.call.IncomingCallModule
import com.fracspace.tooka.call.IncomingCallNotification

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript.
   */
  override fun getMainComponentName(): String = "Tooka"

  /**
   * Prevent Android from restoring the old Fragment state.
   *
   * react-native-screens manages its own screen fragments and
   * restoring them through Android's FragmentManager can cause:
   *
   * "Screen fragments should never be restored."
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    handleCallIntent(intent)
  }

  override fun onResume() {
    super.onResume()
    IncomingCallNotification.appVisible = true
  }

  override fun onPause() {
    IncomingCallNotification.appVisible = false
    super.onPause()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    handleCallIntent(intent)
  }

  /** A tap on the incoming-call notification: show over the lock screen and tell JS. */
  private fun handleCallIntent(intent: Intent?) {
    if (!IncomingCallModule.handleIntent(intent)) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    }
  }

  /**
   * Returns the instance of the ReactActivityDelegate.
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}