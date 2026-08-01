# Native low-latency audio for FX-404 (Stage 1 scaffold).
# Builds libfx404audio.so and links Google Oboe (provided as a prefab AAR by the
# com.google.oboe:oboe Gradle dependency). arm64-v8a only (see build.gradle.kts abiFilters).
cmake_minimum_required(VERSION 3.22.1)
project(fx404audio LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Oboe comes from the prefab package (buildFeatures { prefab = true } in build.gradle.kts).
find_package(oboe REQUIRED CONFIG)

add_library(fx404audio SHARED native_audio.cpp)

target_compile_options(fx404audio PRIVATE -O2 -Wall -Wextra -ffast-math)

target_link_libraries(fx404audio
    oboe::oboe
    android
    log)
