package com.fracspace.tooka.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Bundle

/**
 * Rings for a call push the moment FCM delivers it, without waiting for JS to start
 * (a cold JS start in the background takes seconds and is sometimes never allowed).
 * Receives the same broadcast as React Native Firebase's receiver, which still runs
 * index.js's background handler; that handler checks the call is still ringing and
 * for this user, and cancels the ring if not.
 */
class CallPushReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val extras = intent.extras ?: return
        val callSessionId = extras.getString("callSessionId") ?: return
        when (extras.getString("type")) {
            // App on screen: the socket/FCM path rings it in the app; ringing here too doubled it.
            "INCOMING_CALL" -> if (!IncomingCallNotification.appVisible) {
                IncomingCallNotification.show(context, dataOf(extras))
            }
            "CALL_ENDED" -> IncomingCallNotification.cancel(context, callSessionId)
        }
    }

    /** The push's own fields, without FCM's google.* / gcm.* keys. */
    private fun dataOf(extras: Bundle): Bundle = Bundle().apply {
        for (key in extras.keySet()) {
            if (key.startsWith("google.") || key.startsWith("gcm.") || key == "from" || key == "collapse_key") continue
            extras.getString(key)?.let { putString(key, it) }
        }
    }
}
