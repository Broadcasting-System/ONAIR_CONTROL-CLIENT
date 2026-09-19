import { redirect } from "next/navigation";

/** 주소창에 서버 주소만 쳐도 바로 메인 화면으로 */
export default function Home() {
  redirect("/main");
}
