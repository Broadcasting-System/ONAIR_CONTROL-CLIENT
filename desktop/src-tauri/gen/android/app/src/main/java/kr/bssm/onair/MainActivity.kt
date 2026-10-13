package kr.bssm.onair

import android.graphics.Color
import android.os.Bundle
import android.view.View
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // 화면이 어두워서 상태 표시줄·내비게이션 막대 아이콘을 밝게
    enableEdgeToEdge(
      statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
      navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
    )
    super.onCreate(savedInstanceState)

    // Android WebView(Chrome 124 기준)는 env(safe-area-inset-bottom) 을 0 으로 알려 줘서
    // 컨트롤 화면 아래 탭 막대가 제스처 막대 밑에 깔린다. 웹뷰를 시스템 막대·노치·키보드 안쪽에만 그리게
    // 화면 틀에 그만큼 여백을 준다 (여백은 창 배경색 #101010). 그러면 웹 쪽 env() 는 모두 0 이 된다.
    val content = findViewById<View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(content) { v, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
      v.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
      WindowInsetsCompat.CONSUMED
    }
  }
}
