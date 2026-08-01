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
        versionCode = 155
        versionName = "2.54"

        // Native low-latency audio (Oboe) is 64-bit only; every device from the last several years is
        // arm64, and the App Bundle splits per-ABI so the download stays small.
        ndk {
            abiFilters += "arm64-v8a"
        }
        externalNativeBuild {
            cmake {
                // Oboe's prefab is built against the shared libc++, and prefab enforces a matching STL,
                // so the app's native code must also use c++_shared. AGP then packages libc++_shared.so.
                arguments += "-DANDROID_STL=c++_shared"
            }
        }
    }

    // Build libfx404audio.so from src/main/cpp (Stage 1 native audio scaffold).
    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
            version = "3.22.1"
        }
    }
    // Pin the NDK so CI resolves/downloads a known-good, 16 KB-page-aligned toolchain (Play requirement
    // for native libs). AGP fetches it via the SDK manager when absent.
    ndkVersion = "27.0.12077973"

    // Oboe is delivered as a prefab AAR; enable prefab so CMake's find_package(oboe) resolves it.
    buildFeatures {
        prefab = true
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
    implementation("com.google.oboe:oboe:1.9.0")               // low-latency native audio (prefab .so)
}
