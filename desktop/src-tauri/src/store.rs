//! 접속 정보 저장소.
//! - 데스크탑: OS 키체인 (macOS 키체인 / Windows 자격 증명 관리자 / Linux Secret Service)
//! - 개발용: 디버그 빌드에서 ONAIR_DEV_CRED_FILE=<경로> 를 주면 키체인 대신 파일 (키체인 팝업 없이 시험)
//! - 모바일: 아직 없음 (나중에 Keystore/Keychain 플러그인으로)

use crate::registration::Credentials;

const SERVICE: &str = "kr.bssm.onair";
const ACCOUNT: &str = "credentials";

#[cfg(debug_assertions)]
fn dev_file() -> Option<std::path::PathBuf> {
    std::env::var_os("ONAIR_DEV_CRED_FILE").map(Into::into)
}
#[cfg(not(debug_assertions))]
fn dev_file() -> Option<std::path::PathBuf> {
    None
}

pub fn load() -> Result<Option<Credentials>, String> {
    if let Some(f) = dev_file() {
        return match std::fs::read(&f) {
            Ok(b) => serde_json::from_slice(&b).map(Some).map_err(|e| e.to_string()),
            Err(_) => Ok(None),
        };
    }
    imp::get().and_then(|s| match s {
        Some(s) => serde_json::from_str(&s).map(Some).map_err(|e| format!("저장된 정보를 읽을 수 없어요: {e}")),
        None => Ok(None),
    })
}

pub fn save(c: &Credentials) -> Result<(), String> {
    let json = serde_json::to_string(c).map_err(|e| e.to_string())?;
    if let Some(f) = dev_file() {
        return std::fs::write(f, json).map_err(|e| e.to_string());
    }
    imp::set(&json)
}

pub fn clear() -> Result<(), String> {
    if let Some(f) = dev_file() {
        let _ = std::fs::remove_file(f);
        return Ok(());
    }
    imp::delete()
}

#[cfg(desktop)]
mod imp {
    use super::{ACCOUNT, SERVICE};

    fn entry() -> Result<keyring::Entry, String> {
        keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| format!("키체인을 열 수 없어요: {e}"))
    }
    pub fn get() -> Result<Option<String>, String> {
        match entry()?.get_password() {
            Ok(s) => Ok(Some(s)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(format!("키체인 읽기 실패: {e}")),
        }
    }
    pub fn set(v: &str) -> Result<(), String> {
        entry()?.set_password(v).map_err(|e| format!("키체인 저장 실패: {e}"))
    }
    pub fn delete() -> Result<(), String> {
        match entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(format!("키체인 삭제 실패: {e}")),
        }
    }
}

#[cfg(mobile)]
mod imp {
    pub fn get() -> Result<Option<String>, String> {
        Ok(None)
    }
    pub fn set(_: &str) -> Result<(), String> {
        Err("모바일 저장소는 아직 준비 중이에요.".into())
    }
    pub fn delete() -> Result<(), String> {
        Ok(())
    }
}

#[cfg(all(test, desktop))]
mod tests {
    /// 실제 OS 키체인에 저장 → 읽기 → 지우기. (키체인을 건드리므로 기본은 건너뜀: cargo test -- --ignored)
    #[test]
    #[ignore]
    fn keychain_round_trip() {
        let e = keyring::Entry::new("kr.bssm.onair.test", "round-trip").unwrap();
        e.set_password("{\"server\":\"https://x\"}").unwrap();
        assert_eq!(e.get_password().unwrap(), "{\"server\":\"https://x\"}");
        e.delete_credential().unwrap();
        assert!(matches!(e.get_password(), Err(keyring::Error::NoEntry)));
    }
}
