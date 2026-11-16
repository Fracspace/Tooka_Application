# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Cashfree PG SDK models are serialized/deserialized across the native bridge.
# Keep them intact if release minification is enabled later.
-keep class com.cashfree.** { *; }
-keep class com.cashfree.pg.** { *; }
-keep class cashfree.** { *; }
-dontwarn com.cashfree.**

# Agora (calls): the SDK reaches its Java classes from native code.
-keep class io.agora.** { *; }
-dontwarn io.agora.**

# The app's own native modules, services and receivers (calls, push).
-keep class com.fracspace.tooka.** { *; }
