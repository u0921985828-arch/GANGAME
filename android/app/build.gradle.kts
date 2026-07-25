plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.artifacts.fx404"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.artifacts.fx404"
        minSdk = 24                 // WebViewAssetLoader + modern WebView; covers ~99% of devices
        targetSdk = 36              // API 36 (Android 16) — within Play's required window for new/updated apps (2026)
        versionCode = 27
        versionName = "1.26"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    // The web app is already minified/compressed; don't let AAPT re-compress the .html asset.
    androidResources {
        noCompress += "html"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("androidx.webkit:webkit:1.11.0")            // WebViewAssetLoader (secure origin)
    implementation("androidx.core:core-splashscreen:1.0.1")    // Android 12 splash, back-compat
}
