// src/services/cryptoStorage.js
// Criptografía militar AES-GCM-256 en cliente (Web Crypto API) y BIP-39 mnemonic generator

// Diccionario de 128 palabras representativas para frases semilla de respaldo
const WORDLIST = [
  'aguila', 'ahorro', 'alameda', 'alegria', 'alianza', 'amigo', 'antorcha', 'arbol',
  'arena', 'armonia', 'aurora', 'azteca', 'balanza', 'bosque', 'brisa', 'brujula',
  'cacao', 'camino', 'capital', 'caravana', 'cascada', 'castillo', 'ceiba', 'cenote',
  'certeza', 'cielo', 'cipres', 'clavel', 'colibri', 'cometa', 'cordero', 'corona',
  'cristal', 'cumbre', 'diamante', 'delfin', 'destino', 'diana', 'dinero', 'disciplina',
  'dorado', 'dragon', 'duna', 'eclipse', 'esmeralda', 'escudo', 'espejo', 'esperanza',
  'estrella', 'exito', 'faro', 'fenix', 'firmeza', 'florecer', 'fortuna', 'frontera',
  'fuego', 'galaxia', 'garza', 'gema', 'glaciar', 'golondrina', 'grano', 'guerrero',
  'halcon', 'horizonte', 'huerto', 'iman', 'imperio', 'impulso', 'inmortal', 'isla',
  'jardin', 'jaguar', 'joya', 'juventud', 'laurel', 'leyenda', 'libertad', 'lienzo',
  'lince', 'llama', 'lucero', 'luna', 'magia', 'manantial', 'mariposa', 'medalla',
  'memoria', 'meta', 'milagro', 'mirada', 'moneda', 'montana', 'musica', 'navio',
  'nobleza', 'oasis', 'oceano', 'olivo', 'oraculo', 'oriente', 'orquidea', 'palacio',
  'paloma', 'paraíso', 'paso', 'patria', 'perla', 'pilar', 'pino', 'planeta',
  'plata', 'poder', 'puente', 'puerto', 'pureza', 'quijote', 'quimera', 'radiante',
  'raiz', 'rayo', 'reino', 'reloj', 'renacer', 'riqueza', 'roble', 'rubi'
];

/**
 * Calcula un checksum SHA-256 de cualquier texto o estructura JSON
 */
export async function computeSHA256(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(str));
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Deriva una clave simétrica AES-GCM con PBKDF2 a partir de la contraseña
 */
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Cifra un payload con AES-GCM-256
 */
export async function encryptData(plainData, password) {
  const enc = new TextEncoder();
  const encodedData = enc.encode(typeof plainData === 'string' ? plainData : JSON.stringify(plainData));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encodedData
  );

  return {
    version: '1.0',
    cipher: 'AES-GCM-256',
    salt: Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''),
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
    data: Array.from(new Uint8Array(ciphertext)).map(b => b.toString(16).padStart(2, '0')).join('')
  };
}

/**
 * Descifra un payload cifrado con AES-GCM-256
 */
export async function decryptData(encryptedObj, password) {
  const fromHex = (hex) => new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  
  const salt = fromHex(encryptedObj.salt);
  const iv = fromHex(encryptedObj.iv);
  const data = fromHex(encryptedObj.data);

  const key = await deriveKey(password, salt);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    data
  );

  const dec = new TextDecoder();
  const decryptedText = dec.decode(decryptedBuffer);
  try {
    return JSON.parse(decryptedText);
  } catch (e) {
    return decryptedText;
  }
}

/**
 * Genera una frase mnemónica de 12 palabras determinística o aleatoria
 */
export function generateMnemonicWords(count = 12) {
  const randomValues = new Uint8Array(count);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues).map(val => WORDLIST[val % WORDLIST.length]);
}
