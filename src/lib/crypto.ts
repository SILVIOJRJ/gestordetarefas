// Criptografia E2EE via Web Crypto API nativa
// Algoritmo: AES-GCM 256-bit com chave derivada por PBKDF2
// Nem a chave mestra nem o texto simples chegam ao servidor

const PBKDF2_ITERATIONS = 150_000
const KEY_LENGTH = 256

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer as ArrayBuffer
}

async function deriveKey(masterKey: string, salt: ArrayBuffer): Promise<CryptoKey> {
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
  const saltBytes = window.crypto.getRandomValues(new Uint8Array(16))
  const ivBytes   = window.crypto.getRandomValues(new Uint8Array(12))
  const salt = saltBytes.buffer as ArrayBuffer
  const iv   = ivBytes.buffer as ArrayBuffer
  const key  = await deriveKey(masterKey, salt)

  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  )

  return {
    ciphertext: bufferToBase64(encrypted),
    iv:         bufferToBase64(iv),
    salt:       bufferToBase64(salt),
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
