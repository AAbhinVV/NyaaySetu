import { createHash } from 'crypto'
import { ethers } from 'ethers'

// ─── Lazy-loaded singletons ─────────────────────────────────────────────────
// Not initialized at module load to prevent crashes when blockchain env vars
// are not set (e.g., during tests or in environments that don't use blockchain)

let _provider: ethers.JsonRpcProvider | null = null
let _signer: ethers.NonceManager | null = null
let _contract: ethers.Contract | null = null

function getBlockchainConfig() {
    const polygonUrl = process.env.POLYGON_RPC_URL
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY
    const contractAddress = process.env.CONTRACT_ADDRESS
    const chainId = process.env.POLYGON_CHAIN_ID

    if (!polygonUrl || !privateKey || !contractAddress || !chainId) {
        throw new Error(
            'Missing blockchain environment variables: POLYGON_RPC_URL, POLYGON_CHAIN_ID, BLOCKCHAIN_PRIVATE_KEY, CONTRACT_ADDRESS'
        )
    }

    const parsedChainId = Number(chainId)
    if (!Number.isSafeInteger(parsedChainId) || parsedChainId <= 0) {
        throw new Error('POLYGON_CHAIN_ID must be a positive integer')
    }

    return { polygonUrl, privateKey, contractAddress, chainId: parsedChainId }
}

// Minimal ABI — only the functions we use
const CONTRACT_ABI = [
    'function storeHash(string documentId, bytes hash) external',
    'function verifyHash(string documentId, bytes hash) external view returns (bool)',
]

function getProvider(): ethers.JsonRpcProvider {
    if (!_provider) {
        const { polygonUrl } = getBlockchainConfig()
        _provider = new ethers.JsonRpcProvider(polygonUrl)
    }
    return _provider
}

function getSigner(): ethers.NonceManager {
    if (!_signer) {
        const { privateKey } = getBlockchainConfig()
        _signer = new ethers.NonceManager(new ethers.Wallet(privateKey, getProvider()))
    }
    return _signer
}

async function assertConfiguredNetwork(): Promise<void> {
    const { chainId } = getBlockchainConfig()
    const network = await getProvider().getNetwork()
    if (network.chainId !== BigInt(chainId)) {
        throw new Error(`Blockchain network mismatch: expected chain ${chainId}, received ${network.chainId}`)
    }
}

function getContract(): ethers.Contract {
    if (!_contract) {
        const { contractAddress } = getBlockchainConfig()
        _contract = new ethers.Contract(contractAddress, CONTRACT_ABI, getSigner())
    }
    return _contract
}

// ─── SHA-512 hashing ─────────────────────────────────────────────────────────

/** Compute SHA-512 hash of a file buffer. Returns 128-char hex string. */
export function computeSHA512(buffer: Buffer): string {
    return createHash('sha512').update(buffer).digest('hex')
}

// ─── Blockchain anchoring ─────────────────────────────────────────────────────

/** Anchor a document hash on Polygon. Returns the transaction hash. */
export async function anchorHashOnChain(
    documentId: string,
    sha512Hash: string
): Promise<string> {
    try {
        await assertConfiguredNetwork()
        const contract = getContract()
        const hashBytes = ethers.hexlify(Buffer.from(sha512Hash, 'hex'))

        const tx = await contract.storeHash(documentId, hashBytes)
        await tx.wait(1) // wait for 1 block confirmation

        return tx.hash
    } catch (error) {
        console.error(`Failed to anchor hash for document ${documentId}:`, error)
        throw new Error('Blockchain anchoring failed. The document was saved but not anchored on-chain.')
    }
}

/** Verify a document hash against what's stored on Polygon. */
export async function verifyHashOnChain(
    documentId: string,
    sha512Hash: string
): Promise<boolean> {
    try {
        await assertConfiguredNetwork()
        const contract = getContract()
        const hashBytes = ethers.hexlify(Buffer.from(sha512Hash, 'hex'))

        return await contract.verifyHash(documentId, hashBytes)
    } catch (error) {
        console.error(`Failed to verify hash for document ${documentId}:`, error)
        throw new Error('Blockchain verification failed.')
    }
}
