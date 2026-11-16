package com.fracspace.tooka.call

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import com.fracspace.tooka.MainActivity
import java.lang.ref.WeakReference

/**
 * Native full-screen ringing screen for a pushed call. Opens instantly (no JS start),
 * over the lock screen. Answer hands the call to the app (MainActivity -> JS accepts it);
 * Decline goes through CallActionReceiver. The notification keeps ringing behind it.
 */
class IncomingCallActivity : Activity() {
    private var data: Bundle? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        showOverLockScreen()
        current = WeakReference(this)
        bind(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        bind(intent)
    }

    override fun onDestroy() {
        if (current?.get() === this) current = null
        super.onDestroy()
    }

    private fun bind(intent: Intent?) {
        val bundle = intent?.getBundleExtra(IncomingCallNotification.EXTRA_DATA)
        val id = bundle?.getString("callSessionId")
        if (bundle == null || id == null || !IncomingCallNotification.isRinging(id)) {
            finish()
            return
        }
        data = bundle
        setContentView(buildView(IncomingCallNotification.callerName(bundle)))
    }

    /** Volume buttons silence the ring; the screen stays so the call can still be answered. */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val volumeKey = event.keyCode == KeyEvent.KEYCODE_VOLUME_UP ||
            event.keyCode == KeyEvent.KEYCODE_VOLUME_DOWN ||
            event.keyCode == KeyEvent.KEYCODE_VOLUME_MUTE
        if (volumeKey && CallRinger.isSounding) {
            if (event.action == KeyEvent.ACTION_DOWN) CallRinger.silence()
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    private fun answer() {
        val bundle = data ?: return finish()
        startActivity(
            Intent(this, MainActivity::class.java)
                .setAction(IncomingCallNotification.ACTION_ANSWER)
                .putExtra(IncomingCallNotification.EXTRA_DATA, bundle)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
        )
        finish()
    }

    private fun decline() {
        val bundle = data ?: return finish()
        sendBroadcast(
            Intent(this, CallActionReceiver::class.java)
                .setAction(IncomingCallNotification.ACTION_DECLINE)
                .putExtra(IncomingCallNotification.EXTRA_DATA, bundle),
        )
        finish()
    }

    private fun showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                    WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    private fun dp(value: Int) =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()

    private fun buildView(name: String) = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        setBackgroundColor(Color.parseColor("#141210"))
        setPadding(dp(24), dp(120), dp(24), dp(72))

        addView(TextView(context).apply {
            text = "Incoming Tooka call"
            setTextColor(Color.parseColor("#FFB02E"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            gravity = Gravity.CENTER
        })
        addView(TextView(context).apply {
            text = name
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 32f)
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, dp(16), 0, 0)
        })
        addView(android.view.View(context), LinearLayout.LayoutParams(0, 0, 1f))
        addView(LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            addView(roundButton("Decline", "#E5484D") { decline() })
            addView(android.view.View(context), LinearLayout.LayoutParams(dp(72), 0))
            addView(roundButton("Answer", "#30A46C") { answer() })
        })
    }

    private fun roundButton(label: String, color: String, onTap: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        setTextColor(Color.WHITE)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
        background = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.parseColor(color))
        }
        layoutParams = LinearLayout.LayoutParams(dp(96), dp(96))
        setOnClickListener { onTap() }
    }

    companion object {
        private var current: WeakReference<IncomingCallActivity>? = null

        /** The call stopped ringing (answered elsewhere, declined, cancelled): close the screen. */
        fun close(callSessionId: String) {
            val activity = current?.get() ?: return
            if (activity.data?.getString("callSessionId") == callSessionId) activity.finish()
        }
    }
}
