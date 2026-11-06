package com.fracspace.tooka.call

import android.content.Intent
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/** Runs the "TookaCallAction" JS task (registered in index.js) for a notification action. */
class CallActionTaskService : HeadlessJsTaskService() {
    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
        val extras = intent?.extras ?: return null
        return HeadlessJsTaskConfig("TookaCallAction", Arguments.fromBundle(extras), 15_000L, true)
    }
}
