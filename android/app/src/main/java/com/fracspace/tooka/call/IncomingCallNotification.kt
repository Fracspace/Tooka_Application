package com.fracspace.tooka.call

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import com.fracspace.tooka.MainActivity
import com.fracspace.tooka.R

/**
 * The ringing notification for a call pushed while Tooka is in the background or killed.
 * Full-screen on a locked phone, a heads-up call notification otherwise. Answer and a tap
 * open MainActivity (which hands the action to JS); Decline goes to CallActionReceiver.
 */
object IncomingCallNotification {
    const val ACTION_OPEN = "com.fracspace.tooka.CALL_OPEN"
    const val ACTION_ANSWER = "com.fracspace.tooka.CALL_ANSWER"
    const val ACTION_DECLINE = "com.fracspace.tooka.CALL_DECLINE"
    const val EXTRA_DATA = "tooka_call_data"

    private const val CHANNEL_ID = "tooka_incoming_calls"
    private const val TAG = "incoming-call"

    // Calls already stopped here (declined, cancelled, ended). The same push reaches both
    // CallPushReceiver and the JS background handler; a late show() must not ring them again.
    private val stopped = java.util.Collections.synchronizedSet(LinkedHashSet<String>())
    private val ringing = java.util.Collections.synchronizedSet(LinkedHashSet<String>())

    fun isRinging(callSessionId: String) = ringing.contains(callSessionId)

    /** Set by MainActivity: while Tooka is on screen the in-app call screen rings, not this. */
    @Volatile
    var appVisible = false

    /** Set from JS: on a Tooka call already, so a second call must not ring over it (the app rejects it as busy). */
    @Volatile
    var inCall = false

    private const val PREFS = "tooka_calls"
    private const val KEY_ENABLED = "calls_enabled"

    /** Off after logout: a push still addressed to the old account must not ring (logout's unregister can fail). */
    fun setCallsEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_ENABLED, enabled).apply()
    }

    private fun callsEnabled(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, true)

    // Stopped calls are also kept on disk for a few minutes: if Android kills the app and
    // FCM delivers the same push again, a declined call must not ring a second time.
    private const val KEY_STOPPED = "stopped_calls"
    private const val STOPPED_KEEP_MS = 10 * 60_000L

    private fun rememberStopped(context: Context, callSessionId: String) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val kept = (prefs.getStringSet(KEY_STOPPED, emptySet()) ?: emptySet()).filter {
            val at = it.substringAfterLast(':').toLongOrNull() ?: return@filter false
            now - at in 0..STOPPED_KEEP_MS
        }.toMutableSet()
        kept.add("$callSessionId:$now")
        prefs.edit().putStringSet(KEY_STOPPED, kept).apply()
    }

    private fun wasStopped(context: Context, callSessionId: String): Boolean =
        (context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getStringSet(KEY_STOPPED, emptySet()) ?: emptySet())
            .any { it.substringBeforeLast(':') == callSessionId }

    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())

    fun callerName(data: Bundle): String =
        data.getString("spaName")?.takeIf { it.isNotBlank() }
            ?: data.getString("callerName")?.takeIf { it.isNotBlank() }
            ?: "Spa"

    fun show(context: Context, data: Bundle) {
        val callSessionId = data.getString("callSessionId") ?: return
        if (stopped.contains(callSessionId) || ringing.contains(callSessionId)) return
        if (wasStopped(context, callSessionId)) return
        if (inCall || !callsEnabled(context)) return
        val ringMs = remainingMs(data)
        ensureChannel(context)

        val name = callerName(data)
        val code = callSessionId.hashCode()

        // Tapping the notification, or a locked phone, opens the native ringing screen at once.
        val openIntent = PendingIntent.getActivity(
            context,
            code,
            Intent(context, IncomingCallActivity::class.java)
                .putExtra(EXTRA_DATA, data)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val answerIntent = activityIntent(context, ACTION_ANSWER, data, code + 1)
        val declineIntent = PendingIntent.getBroadcast(
            context,
            code + 2,
            Intent(context, CallActionReceiver::class.java)
                .setAction(ACTION_DECLINE)
                .putExtra(EXTRA_DATA, data),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val caller = Person.Builder().setName(name).setImportant(true).build()
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(name)
            .setContentText("Incoming Tooka call")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setContentIntent(openIntent)
            .setFullScreenIntent(openIntent, true)
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, declineIntent, answerIntent))

        builder.setTimeoutAfter(ringMs)

        val notification = builder.build().apply { flags = flags or Notification.FLAG_INSISTENT }
        try {
            ringing.add(callSessionId)
            NotificationManagerCompat.from(context).notify(TAG, code, notification)
            // The notification times out on its own; the ringing screen must go with it.
            mainHandler.postDelayed({
                if (ringing.remove(callSessionId)) IncomingCallActivity.close(callSessionId)
            }, ringMs)
        } catch (e: SecurityException) {
            // POST_NOTIFICATIONS not granted: nothing we can show.
        }
    }

    fun cancel(context: Context, callSessionId: String) {
        stopped.add(callSessionId)
        rememberStopped(context, callSessionId)
        while (stopped.size > 50) stopped.remove(stopped.first())
        ringing.remove(callSessionId)
        NotificationManagerCompat.from(context).cancel(TAG, callSessionId.hashCode())
        IncomingCallActivity.close(callSessionId)
    }

    /** Android 14+ lets the user turn off full-screen call screens per app. */
    fun canUseFullScreen(context: Context): Boolean =
        Build.VERSION.SDK_INT < 34 ||
            context.getSystemService(NotificationManager::class.java)?.canUseFullScreenIntent() != false

    private fun activityIntent(context: Context, action: String, data: Bundle, code: Int): PendingIntent =
        PendingIntent.getActivity(
            context,
            code,
            Intent(context, MainActivity::class.java)
                .setAction(action)
                .putExtra(EXTRA_DATA, data)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

    /**
     * How long to ring: the server's ring window (expiresAt), at most 60s. CallPushReceiver
     * measures it against FCM's send time ("ringMs"), so a phone whose clock is off still
     * rings. Without that, the phone's clock is used, and a result outside 0-60s means the
     * clock is off: ring the full 60s and let the server-side checks end it.
     */
    private fun remainingMs(data: Bundle): Long {
        data.getString("ringMs")?.toLongOrNull()?.let { return it.coerceIn(1_000L, 60_000L) }
        val expiresAt = data.getString("expiresAt") ?: return 60_000L
        val at = parseIso(expiresAt) ?: return 60_000L
        val left = at - System.currentTimeMillis()
        return if (left in 1_000L..60_000L) left else 60_000L
    }

    fun parseExpiry(value: String?): Long? = value?.let { parseIso(it) }

    // java.time needs API 26; minSdk is 24.
    private fun parseIso(value: String): Long? {
        for (pattern in arrayOf("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", "yyyy-MM-dd'T'HH:mm:ss'Z'")) {
            try {
                val format = java.text.SimpleDateFormat(pattern, java.util.Locale.US)
                format.timeZone = java.util.TimeZone.getTimeZone("UTC")
                return format.parse(value)?.time
            } catch (e: Exception) {
                // try the next pattern
            }
        }
        return null
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val sound = Uri.parse("android.resource://${context.packageName}/${R.raw.incoming_ring}")
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Incoming calls", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Rings when a spa calls you"
                setSound(
                    sound,
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 1000, 1000)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            },
        )
    }
}
