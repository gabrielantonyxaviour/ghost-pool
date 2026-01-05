//! Build wasm files from odra contracts.
//!
//! For WASM target: provides the contract entry points
//! For native target: provides an empty main (not meant to be run)

#![cfg_attr(target_arch = "wasm32", no_std)]
#![cfg_attr(target_arch = "wasm32", no_main)]

#[allow(unused_imports)]
use ghost_pool;

#[cfg(not(target_arch = "wasm32"))]
fn main() {
    // This binary is only meaningful for WASM targets.
    // It exists to satisfy cargo's requirement for a main function.
    eprintln!("This binary is for WASM compilation only. Use `cargo odra build`.");
}
