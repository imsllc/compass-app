package expo.modules.fieldheading

import org.junit.Assert.*
import org.junit.Test
import kotlin.math.cos
import kotlin.math.sin

class HeadingMathTest {
  private fun matrix(heading: Double, pitch: Double = 0.0): FloatArray {
    val h = Math.toRadians(heading)
    val p = Math.toRadians(pitch)
    return floatArrayOf(cos(h).toFloat(), (sin(h)*cos(p)).toFloat(), (-sin(h)*sin(p)).toFloat(),
      -sin(h).toFloat(), (cos(h)*cos(p)).toFloat(), (-cos(h)*sin(p)).toFloat(),
      0f, sin(p).toFloat(), cos(p).toFloat())
  }

  @Test fun cardinalDirectionsAndTilt() {
    for (heading in listOf(0.0, 90.0, 180.0, 270.0)) {
      for (pitch in listOf(-35.0, 0.0, 35.0)) {
        assertEquals(heading, HeadingMath.magnetic(matrix(heading, pitch))!!, 0.0001)
      }
    }
  }

  @Test fun halfTurnChangesHeadingBy180() {
    for (heading in listOf(24.0, 137.0, 204.0, 309.0)) {
      val initial = HeadingMath.magnetic(matrix(heading))!!
      val reversed = HeadingMath.magnetic(matrix(heading + 180))!!
      assertEquals(180.0, HeadingMath.normalize(reversed - initial), 0.0001)
    }
  }

  @Test fun clockwiseAndCounterclockwiseAcrossNorth() {
    for (heading in listOf(-361.0, -1.0, 0.0, 1.0, 359.0, 361.0)) {
      assertEquals(HeadingMath.normalize(heading), HeadingMath.magnetic(matrix(heading))!!, 0.0001)
    }
  }

  @Test fun verticalTopHasNoHorizontalHeading() {
    assertNull(HeadingMath.magnetic(matrix(90.0, 90.0)))
  }
}
