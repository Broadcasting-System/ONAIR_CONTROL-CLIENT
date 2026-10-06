// 릴리스 빌드에서 Windows 콘솔 창 안 띄우기
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    onair_desktop_lib::run()
}
