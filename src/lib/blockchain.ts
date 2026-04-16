import { createHash } from 'crypto'
import { ethers } from 'ethers'

const polygon_url = process.env.POLYGON_RPC_URL
const blockchain_private_key = process.env.BLOCKCHAIN_PRIVATE_KEY
const contract_address = process.env.CONTRACT_ADDRESS

if (!polygon_url || !blockchain_private_key || !contract_address) {
    throw new Error('Missing blockchain environment variables')
}

// Minimal ABI — only the functions we use
const CONTRACT_ABI = [
    'function storeHash(string documentId, bytes64 hash) external',
    'function verifyHash(string documentId, bytes64 hash) external view returns (bool)',
]

function getProvider() {
    return new ethers.JsonRpcProvider(polygon_url)
}

function getSigner() {
    const provider = getProvider()
    return new ethers.Wallet(blockchain_private_key!, provider)
}

function getContract() {
    const signer = getSigner()
    return new ethers.Contract(
        contract_address!,
        CONTRACT_ABI,
        signer
    )
}

//sha-512 hash for file
export function computeSHA512(buffer: Buffer): string {
    return createHash('sha512').update(buffer).digest('hex')
}

// hash to polygon
export async function anchorHashOnChain(
    documentId: string,
    sha512Hash: string
): Promise<string> {
    const contract = getContract()
    const hashBytes = ethers.hexlify(Buffer.from(sha512Hash, 'hex'))

    const tx = await contract.storeHash(documentId, hashBytes)
    await tx.wait(1) // wait for 1 block confirmation

    return tx.hash
}

// Verify a hash against what's stored on chain
export async function verifyHashOnChain(
    documentId: string,
    sha512Hash: string
): Promise<boolean> {
    const contract = getContract()
    const hashBytes = ethers.hexlify(Buffer.from(sha512Hash, 'hex'))

    return contract.verifyHash(documentId, hashBytes)
}