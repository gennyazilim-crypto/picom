# Read Supabase CLI access token from Windows Credential Manager (never prints token).
# Trusted local ops only: injects SUPABASE_ACCESS_TOKEN into the child process env.
# Do not wrap untrusted commands (env dumpers, verbose debuggers, crash reporters).
# Usage: .\scripts\with-supabase-cli-token.ps1 node scripts\set-auth-redirect-allowlist.mjs --audit
param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Command
)

$ErrorActionPreference = "Stop"

$sig = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class CredReadNative {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public uint Flags;
    public uint Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist;
    public uint AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredRead(string target, uint type, uint reservedFlag, out IntPtr credentialPtr);

  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern void CredFree(IntPtr buffer);

  public static string ReadPassword(string target) {
    IntPtr ptr;
    if (!CredRead(target, 1 /* GENERIC */, 0, out ptr)) {
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    }
    try {
      var cred = (CREDENTIAL)Marshal.PtrToStructure(ptr, typeof(CREDENTIAL));
      if (cred.CredentialBlob == IntPtr.Zero || cred.CredentialBlobSize == 0) return "";
      byte[] bytes = new byte[cred.CredentialBlobSize];
      Marshal.Copy(cred.CredentialBlob, bytes, 0, (int)cred.CredentialBlobSize);
      // Prefer UTF-8 (Go/keyring often stores raw bytes). Fall back to Unicode.
      string utf8 = Encoding.UTF8.GetString(bytes).TrimEnd('\0').Trim();
      if (LooksLikeToken(utf8)) return utf8;
      string uni = Encoding.Unicode.GetString(bytes).TrimEnd('\0').Trim();
      if (LooksLikeToken(uni)) return uni;
      string ascii = Encoding.ASCII.GetString(bytes).TrimEnd('\0').Trim();
      if (LooksLikeToken(ascii)) return ascii;
      return utf8.Length >= uni.Length ? utf8 : uni;
    } finally {
      CredFree(ptr);
    }
  }

  static bool LooksLikeToken(string value) {
    if (string.IsNullOrWhiteSpace(value)) return false;
    foreach (char c in value) {
      if (c < 32 || c > 126) return false;
    }
    return value.Length >= 20;
  }
}
"@

Add-Type -TypeDefinition $sig -ErrorAction Stop

$targets = @(
  "Supabase CLI:supabase",
  "LegacyGeneric:target=Supabase CLI:supabase"
)

$token = $null
$used = $null
foreach ($t in $targets) {
  try {
    $candidate = [CredReadNative]::ReadPassword($t)
    if ($candidate -and $candidate.Trim().Length -gt 20) {
      $token = $candidate.Trim()
      $used = $t
      break
    }
  } catch {
    # try next target
  }
}

if (-not $token) {
  Write-Error "Could not read Supabase CLI token from Credential Manager."
  exit 1
}

Write-Host ("TOKEN_LOADED from={0} len={1}" -f $used, $token.Length)
$env:SUPABASE_ACCESS_TOKEN = $token
$env:SUPABASE_PROJECT_REF = "ufmtvqtsklqsmqxefbbs"

if (-not $Command -or $Command.Count -eq 0) {
  Write-Host "Token loaded into process env for this shell only. No command provided."
  exit 0
}

& $Command[0] @($Command[1..($Command.Length - 1)])
exit $LASTEXITCODE
