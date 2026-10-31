// Criptografia E2EE via Web Crypto API nativa
// Algoritmo: AES-GCM 256-bit com chave derivada por PBKDF2
// Nem a chave mestra nem o texto simples chegam ao servidor

const PBKDF2_ITERATIONS = 150_000
const KEY_LENGTH = 256

function bufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
}

function base64ToBuffer(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

async function deriveKey(masterKey: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(masterKey),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * Cifra `plaintext` com a `masterKey` usando AES-GCM + PBKDF2.
 * Retorna ciphertext, iv e salt em base64 — seguros para armazenar no servidor.
 */
export async function encryptSecret(
  plaintext: string,
  masterKey: string,
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const enc = new TextEncoder()
  const salt = window.crypto.getRandomValues(new Uint8Array(16))
  const iv   = window.crypto.getRandomValues(new Uint8Array(12))
  const key  = await deriveKey(masterKey, salt)

  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  )

  return {
    ciphertext: bufferToBase64(encrypted),
    iv:         bufferToBase64(iv.buffer),
    salt:       bufferToBase64(salt.buffer),
  }
}

/**
 * Decifra um payload AES-GCM usando a `masterKey`.
 * Lança erro se a chave estiver errada ou o dado corrompido.
 */
export async function decryptSecret(
  ciphertext: string,
  iv: string,
  salt: string,
  masterKey: string,
): Promise<string> {
  const key = await deriveKey(masterKey, base64ToBuffer(salt))

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBuffer(iv) },
    key,
    base64ToBuffer(ciphertext),
  )

  return new TextDecoder().decode(decrypted)
}
