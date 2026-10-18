package expo.modules.fieldheading

internal object HeadingMath {
  fun normalize(degrees: Double) = ((degrees % 360.0) + 360.0) % 360.0

  // Second column is the device top edge in east/north/up coordinates.
  fun magnetic(matrix: FloatArray): Double? {
    val east = matrix[1].toDouble()
    val north = matrix[4].toDouble()
    if (!east.isFinite() || !north.isFinite() || kotlin.math.hypot(east, north) < 0.01) return null
    return normalize(Math.toDegrees(kotlin.math.atan2(east, north)))
  }
}
