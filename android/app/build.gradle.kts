plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Release (upload) keystore for Play — provided by CI from GitHub secrets (never committed).
// If it isn't present (e.g. a local/debug build, or CI without the signing secrets set), the
// release build is simply left unsigned instead of failing. The debug build is unaffected.
val releaseKeystore = rootProject.file(System.getenv("RELEASE_KEYSTORE_PATH") ?: "release.keystore")

android {
    namespace = "com.artifacts.fx404"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.artifacts.fx404"
        minSdk = 24                 // WebViewAssetLoader + modern WebView; covers ~99% of devices
        targetSdk = 36              // API 36 (Android 16) — within Play's required window for new/updated apps (2026)
        versionCode = 154
        versionName = "2.53"
    }

    signingConfigs {
        if (releaseKeystore.exists()) {
            create("release") {
                storeFile = releaseKeystore
                storePassword = System.getenv("RELEASE_STORE_PASSWORD")
                keyAlias = System.getenv("RELEASE_KEY_ALIAS")
                keyPassword = System.getenv("RELEASE_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Sign with the upload key only when the keystore is present (CI with secrets set);
            // otherwise the release artifact stays unsigned rather than failing the build.
            if (releaseKeystore.exists()) signingConfig = signingConfigs.getByName("release")
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

    // No incluir el bloque de metadatos de dependencias (firmado por Google) en el APK/AAB. No
    // aporta al usuario, engorda ligeramente el artefacto y es información de build innecesaria.
    dependenciesInfo {
        includeInApk = false
        includeInBundle = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("androidx.webkit:webkit:1.11.0")            // WebViewAssetLoader (secure origin)
    implementation("androidx.core:core-splashscreen:1.0.1")    // Android 12 splash, back-compat
}
