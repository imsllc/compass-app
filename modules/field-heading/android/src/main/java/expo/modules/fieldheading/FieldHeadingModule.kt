package expo.modules.fieldheading

import android.content.Context
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Face-up portrait: device top is forward. No location is requested by this module. */
class FieldHeadingModule : Module(), SensorEventListener {
  private val manager get() = appContext.reactContext!!.getSystemService(Context.SENSOR_SERVICE) as SensorManager
  private var gravity: FloatArray? = null
  private var magnetic: FloatArray? = null
  private var gravityTime = 0L
  private var magneticTime = 0L
  private var calibration = 0
  private var lastEmit = 0L
  private var declination: Float? = null
  private var referenceTime = 0.0
  private var fused = false

  override fun definition() = ModuleDefinition {
    Name("FieldHeading")
    Events("heading")
    Function("isEmulator") {
      Build.FINGERPRINT.startsWith("generic") || Build.FINGERPRINT.contains("emulator") || Build.MODEL.contains("Emulator") || Build.MODEL.contains("sdk_gphone") || Build.HARDWARE.contains("goldfish") || Build.HARDWARE.contains("ranchu")
    }
    Function("available") {
      manager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) != null || (manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null && manager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD) != null)
    }
    Function("setReference") { latitude: Double, longitude: Double, altitude: Double, timestamp: Double ->
      declination = GeomagneticField(latitude.toFloat(), longitude.toFloat(), altitude.toFloat(), timestamp.toLong()).declination
      referenceTime = timestamp
    }
    OnStartObserving {
      gravity = null; magnetic = null; lastEmit = 0L; calibration = 0
      manager.unregisterListener(this@FieldHeadingModule)
      // GAME_ROTATION_VECTOR has no north reference; use the standard fused sensor.
      val rotation = manager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
      fused = rotation != null && manager.registerListener(this@FieldHeadingModule, rotation, SensorManager.SENSOR_DELAY_GAME)
      if (!fused) {
      manager.registerListener(this@FieldHeadingModule, manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER), SensorManager.SENSOR_DELAY_GAME)
      manager.registerListener(this@FieldHeadingModule, manager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD), SensorManager.SENSOR_DELAY_GAME)
      }
    }
    OnStopObserving { manager.unregisterListener(this@FieldHeadingModule) }
    OnDestroy { manager.unregisterListener(this@FieldHeadingModule) }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
    if (sensor?.type == Sensor.TYPE_MAGNETIC_FIELD) calibration = accuracy
  }

  override fun onSensorChanged(event: SensorEvent) {
    val now = System.currentTimeMillis()
    if (fused) {
      if (event.sensor.type != Sensor.TYPE_ROTATION_VECTOR) return
      val matrix = FloatArray(9)
      SensorManager.getRotationMatrixFromVector(matrix, event.values)
      emit(matrix, event.accuracy, now)
      return
    }
    if (event.sensor.type == Sensor.TYPE_ACCELEROMETER) {
      gravity = event.values.clone()
      gravityTime = event.timestamp
      return
    } else if (event.sensor.type == Sensor.TYPE_MAGNETIC_FIELD) {
      magnetic = event.values.clone(); magneticTime = event.timestamp
    }
    val g = gravity ?: return
    val m = magnetic ?: return
    if (kotlin.math.abs(magneticTime - gravityTime) > 250_000_000L) return
    val matrix = FloatArray(9)
    if (!SensorManager.getRotationMatrix(matrix, null, g, m)) return
    emit(matrix, event.accuracy, now)
  }

  private fun emit(matrix: FloatArray, accuracy: Int, now: Long) {
    if (now - lastEmit < 80) return
    val heading = HeadingMath.magnetic(matrix) ?: return
    val trueHeading = if (declination != null && now - referenceTime < 30000) (heading + declination!! + 360) % 360 else -1.0
    lastEmit = now
    sendEvent("heading", mapOf("magnetic" to heading, "true" to trueHeading, "accuracy" to accuracy, "timestamp" to now.toDouble(), "flat" to (matrix[8] > 0.7071f)))
  }
}
