/** * POL INFINITY Dashboard Logic
 * Native Ethers.js v5.7.2 + MetaMask
 */

// We use lower-case here to avoid checksum issues during init
const contractAddress = "0xcF0e9664B10F8483E883B7B99e27ef8f4Ff20682".toLowerCase();
const abi = [
    "function invest(address referrer) public payable",
    "function withdraw() public",
    "function totalStaked() public view returns (uint256)",
    "function totalUsers() public view returns (uint256)",
    "function totalRefBonus() public view returns (uint256)",
    "function getUserAvailable(address userAddress) public view returns (uint256)",
    "function getUserTotalDeposits(address userAddress) public view returns (uint256)",
    "function getUserTotalWithdrawn(address userAddress) public view returns (uint256)",
    "function getUserReferralTotalBonus(address userAddress) public view returns (uint256[4])",
    "event NewDeposit(address indexed user, uint8 plan, uint256 percent, uint256 amount, uint256 profit, uint256 start, uint256 finish)",
    "event Withdrawn(address indexed user, uint256 amount)",
    "event RefBonus(address indexed referrer, address indexed referral, uint256 indexed level, uint256 amount)"
];

// State variables
let provider, signer, contract, userAddress;
let refreshInterval = null;
let leaderboardInterval = null; 
let currentReferrer = "0x0000000000000000000000000000000000000000";
let lastPromoTime = Date.now();

// --- FOMO ADDITION: Live Ticker Variables ---
let liveEarningsValue = 0;
let tickerInterval = null;

// --- NEW: EARNINGS CALCULATOR LOGIC ---
function calculateEarnings() {
    const input = document.getElementById('calcInput');
    if (!input) return;
    
    const amount = parseFloat(input.value) || 0;
    
    // Logic: 5% Daily Return
    const daily = amount * 0.05;
    const weekly = daily * 7;
    const monthly = daily * 30;
    const yearly = daily * 365;

    const resDaily = document.getElementById('resDaily');
    const resWeekly = document.getElementById('resWeekly');
    const resMonthly = document.getElementById('resMonthly');
    const resYearly = document.getElementById('resYearly');

    if (resDaily) resDaily.innerText = daily.toFixed(2) + " POL";
    if (resWeekly) resWeekly.innerText = weekly.toFixed(2) + " POL";
    if (resMonthly) resMonthly.innerText = monthly.toFixed(2) + " POL";
    if (resYearly) resYearly.innerText = yearly.toFixed(2) + " POL";
}

function startLiveTicker() {
    if (tickerInterval) clearInterval(tickerInterval);
    tickerInterval = setInterval(() => {
        if (liveEarningsValue > 0) {
            // 5% daily = 0.00005787% per second
            const increment = liveEarningsValue * (0.05 / 86400); 
            liveEarningsValue += increment;
            const el = document.getElementById('userAvailable');
            if (el) el.innerText = liveEarningsValue.toFixed(6);
        }
    }, 1000);
}

// --- GLOBAL BONUS CYCLE TIMER ---
function startGlobalBonusCountdown() {
    setInterval(() => {
        const now = new Date();
        const nextCycle = new Date();
        nextCycle.setUTCHours(24, 0, 0, 0); // Resets at UTC midnight
        
        const diff = nextCycle - now;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        
        const timerEl = document.getElementById('globalCycleTimer');
        if (timerEl) timerEl.innerText = `${h}h ${m}m ${s}s`;
    }, 1000);
}

// --- 1. PROMO ENGINE: Popups and Urgency ---
function startPromoEngine() {
    const addresses = ["0x71C...", "0x3A2...", "0xF51...", "0x88B...", "0xbc2...", "0x44a..."];
    const amounts = [250, 1000, 50, 5000, 150, 300, 2500, 10];

    setInterval(() => {
        const quietTime = Date.now() - lastPromoTime;
        if (quietTime > 40000) { 
            const addr = addresses[Math.floor(Math.random() * addresses.length)];
            const amt = amounts[Math.floor(Math.random() * amounts.length)];
            const action = Math.random() > 0.3 ? "Deposited" : "Withdrew";
            
            Swal.fire({
                toast: true,
                position: 'bottom-start',
                showConfirmButton: false,
                timer: 4500,
                timerProgressBar: true,
                background: '#1a1d21',
                color: '#fff',
                icon: action === "Deposited" ? 'success' : 'info',
                title: `<small style="color:#00f2ff">DAILY 5% RETURNS HIGHLIGHT</small>`,
                html: `<b style="font-size:0.85rem">${addr} just ${action} ${amt}.00 POL</b>`
            });
            lastPromoTime = Date.now();
        }
    }, 15000);
}

function triggerCelebration() {
    if (typeof confetti === 'function') {
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#7B3FE4', '#9d50bb', '#00f2ff']
        });
    }
}

// 1. App Initialization
async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    const display = document.getElementById('uplineAddressDisplay');
    
    if (ref && ethers.utils.isAddress(ref)) {
        currentReferrer = ethers.utils.getAddress(ref.toLowerCase());
        localStorage.setItem('pol_infinity_ref', currentReferrer);
        if(display) display.innerText = currentReferrer.substring(0,6) + "..." + currentReferrer.substring(38);
    } else {
        const savedRef = localStorage.getItem('pol_infinity_ref');
        if (savedRef && ethers.utils.isAddress(savedRef)) {
            currentReferrer = savedRef;
            if(display) display.innerText = currentReferrer.substring(0,6) + "..." + currentReferrer.substring(38);
        } else {
            if(display) display.innerText = "Default (Admin)";
        }
    }

    if (typeof window.ethereum !== 'undefined') {
        provider = new ethers.providers.Web3Provider(window.ethereum, "any");

        const publicContract = new ethers.Contract(contractAddress, abi, provider);
        publicContract.on("NewDeposit", (user, plan, percent, amount) => {
            lastPromoTime = Date.now();
            const val = parseFloat(ethers.utils.formatEther(amount)).toFixed(2);
            Swal.fire({
                toast: true, position: 'top-end', showConfirmButton: false, timer: 3000,
                icon: 'success', title: 'Live Deposit!', text: `${val} POL from ${user.substring(0,6)}...`
            });
            loadGlobalData();
        });

        startPromoEngine();
        startGlobalBonusCountdown();

        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                userAddress = accounts[0];
                await setupConnectedState();
            }
        } catch (err) {
            console.error("Initial account check failed:", err);
        }

        window.ethereum.on('accountsChanged', async (accounts) => {
            if (accounts.length > 0) {
                userAddress = accounts[0];
                await setupConnectedState();
            } else {
                handleDisconnect();
            }
        });

        window.ethereum.on('chainChanged', () => window.location.reload());

        loadGlobalData();
        updateLeaderboard();
        
        leaderboardInterval = setInterval(updateLeaderboard, 300000); 
        setInterval(loadGlobalData, 30000); 
    } else {
        Swal.fire("Web3 Not Found", "Please use a Web3 browser like MetaMask, Trust Wallet or TokenPocket.", "warning");
    }
}

// 2. Main Connection Toggle
async function toggleConnection() {
    if (!window.ethereum) return Swal.fire("Error", "Wallet not detected.", "error");

    if (userAddress) {
        handleDisconnect();
        Swal.fire({ icon: 'info', title: 'Wallet Disconnected', toast: true, position: 'top-end', timer: 3000, showConfirmButton: false });
    } else {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            userAddress = accounts[0];

            const { chainId } = await provider.getNetwork();
            if (chainId !== 137) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0x89' }], 
                    });
                } catch (err) {
                    if (err.code === 4902) {
                        Swal.fire("Network Missing", "Please add Polygon Mainnet to your wallet.", "error");
                    }
                    return;
                }
            }
            await setupConnectedState();
        } catch (e) {
            console.error("Connection rejected");
        }
    }
}

// 3. UI State Management - FIXED: Added IMMEDIATE DATA FETCH
async function setupConnectedState() {
    signer = provider.getSigner();
    const normalizedContractAddr = ethers.utils.getAddress(contractAddress.toLowerCase());
    contract = new ethers.Contract(normalizedContractAddr, abi, signer);
    
    const connectBtn = document.getElementById('connect-btn');
    if (connectBtn) {
        connectBtn.innerText = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
        connectBtn.classList.add('connected');
    }
    
    // FETCH IMMEDIATELY WITHOUT DELAY
    await refreshAllData();
    startLiveTicker(); 

    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(refreshAllData, 30000);
}

function handleDisconnect() {
    userAddress = null;
    contract = null;
    if (refreshInterval) clearInterval(refreshInterval);
    if (tickerInterval) clearInterval(tickerInterval);
    
    const connectBtn = document.getElementById('connect-btn');
    if (connectBtn) {
        connectBtn.innerText = "Connect Wallet";
        connectBtn.classList.remove('connected');
    }
    resetUI();
}

async function refreshAllData() {
    if (!userAddress) return;
    // Execute both in parallel for maximum speed on mobile
    await Promise.all([
        loadUserData(),
        loadGlobalData(),
        updateUIConnected()
    ]);
    updateTransactionHistory();
}

// 4. Data Loading
async function updateUIConnected() {
    try {
        const balance = await provider.getBalance(userAddress);
        document.getElementById('walletBalance').innerText = `${parseFloat(ethers.utils.formatEther(balance)).toFixed(4)} POL`;
        
        const refLink = `${window.location.origin}${window.location.pathname}?ref=${userAddress}`;
        const refContainer = document.getElementById('refLink');
        if (refContainer) refContainer.innerText = refLink;
    } catch (e) { console.error("UI Refresh Error", e); }
}

async function loadGlobalData() {
    const readOnly = new ethers.Contract(contractAddress, abi, provider);
    try {
        const [staked, users, totalRef] = await Promise.all([
            readOnly.totalStaked(),
            readOnly.totalUsers(),
            readOnly.totalRefBonus()
        ]);
        
        const realStaked = parseFloat(ethers.utils.formatEther(staked));
        const displayStaked = 1500.00 + (realStaked * 2.0);
        document.getElementById('totalStaked').innerText = `${displayStaked.toLocaleString(undefined, {minimumFractionDigits: 2})} POL`;
        
        const realUsersCount = users.toNumber();
        const displayUsers = 50 + realUsersCount + Math.floor(realUsersCount / 5);
        document.getElementById('totalUsers').innerText = displayUsers.toString();
        document.getElementById('totalRefBonusGlobal').innerText = `${parseFloat(ethers.utils.formatEther(totalRef)).toFixed(2)} POL`;

        const filter = readOnly.filters.Withdrawn();
        const events = await readOnly.queryFilter(filter, -20000);
        let realWithdrawWei = ethers.BigNumber.from(0);
        events.forEach(e => realWithdrawWei = realWithdrawWei.add(e.args.amount));
        
        const realWithdrawValue = parseFloat(ethers.utils.formatEther(realWithdrawWei));
        const displayWithdraw = 500.00 + (realWithdrawValue * 1.5);
        document.getElementById('totalPlatformWithdrawn').innerText = `${displayWithdraw.toLocaleString(undefined, {minimumFractionDigits: 2})} POL`;

    } catch (e) { console.error("Global Data Error", e); }
}

async function loadUserData() {
    if (!contract || !userAddress) return;
    try {
        const [available, totalDep, withdrawn, refBonuses] = await Promise.all([
            contract.getUserAvailable(userAddress),
            contract.getUserTotalDeposits(userAddress),
            contract.getUserTotalWithdrawn(userAddress),
            contract.getUserReferralTotalBonus(userAddress)
        ]);

        liveEarningsValue = parseFloat(ethers.utils.formatEther(available));
        document.getElementById('userAvailable').innerText = liveEarningsValue.toFixed(6);
        document.getElementById('userTotalStaked').innerText = `${parseFloat(ethers.utils.formatEther(totalDep)).toFixed(2)} POL`;
        document.getElementById('userWithdrawn').innerText = `${parseFloat(ethers.utils.formatEther(withdrawn)).toFixed(2)} POL`;

        refBonuses.forEach((bonus, i) => {
            const el = document.getElementById(`lvl${i + 1}Bonus`);
            if (el) el.innerText = `${parseFloat(ethers.utils.formatEther(bonus)).toFixed(2)} POL`;
        });

        // Optimized Referral Fetch
        const filter = contract.filters.RefBonus(userAddress);
        const refEvents = await contract.queryFilter(filter, -50000);
        const directSet = new Set();
        const teamSet = new Set();
        refEvents.forEach(e => {
            const referral = e.args.referral.toLowerCase();
            teamSet.add(referral);
            if(e.args.level.toNumber() === 0) directSet.add(referral);
        });
        document.getElementById('directReferrals').innerText = directSet.size;
        document.getElementById('totalTeam').innerText = teamSet.size;

    } catch (e) { console.error("User Data Error", e); }
}

// 5. Transaction History
async function updateTransactionHistory() {
    const historyBody = document.getElementById('txHistoryBody');
    if (!historyBody || !contract || !userAddress) return;

    try {
        const depFilter = contract.filters.NewDeposit(userAddress);
        const events = await contract.queryFilter(depFilter, -10000);
        
        let sortedEvents = events.map(e => ({
            amount: parseFloat(ethers.utils.formatEther(e.args.amount)),
            date: e.args.start * 1000,
            hash: e.transactionHash
        })).sort((a, b) => b.date - a.date);

        historyBody.innerHTML = sortedEvents.map(tx => `
            <tr>
                <td><span class="badge bg-success bg-opacity-10 text-success">Deposit</span></td>
                <td class="fw-bold text-white">${tx.amount.toFixed(2)} POL</td>
                <td class="text-secondary small">${new Date(tx.date).toLocaleDateString()}</td>
                <td><a href="https://polygonscan.com/tx/${tx.hash}" target="_blank" class="text-info"><i class="fa-solid fa-external-link small"></i></a></td>
            </tr>
        `).join('') || "<tr><td colspan='4' class='text-center text-muted py-4'>No recent transactions</td></tr>";
    } catch (e) { console.error("History Error", e); }
}

// 6. Leaderboard
async function updateLeaderboard() {
    const lbBody = document.getElementById('leaderboardBody');
    if (!lbBody) return;
    try {
        const readOnly = new ethers.Contract(contractAddress, abi, provider);
        const filter = readOnly.filters.RefBonus();
        const events = await readOnly.queryFilter(filter, -30000);
        const referrerTotals = {};
        events.forEach(event => {
            const ref = event.args.referrer;
            if (!referrerTotals[ref]) referrerTotals[ref] = ethers.BigNumber.from(0);
            referrerTotals[ref] = referrerTotals[ref].add(event.args.amount);
        });
        const sorted = Object.entries(referrerTotals).sort((a, b) => (b[1].gt(a[1]) ? 1 : -1)).slice(0, 10);
        lbBody.innerHTML = sorted.map((item, index) => `
            <tr>
                <td><span class="badge ${index < 3 ? 'bg-warning' : 'bg-secondary'}">${index + 1}</span></td>
                <td class="small text-secondary">${item[0].substring(0, 6)}...${item[0].substring(38)}</td>
                <td class="fw-bold text-info text-end">${parseFloat(ethers.utils.formatEther(item[1])).toFixed(2)}</td>
            </tr>
        `).join('') || "<tr><td colspan='3' class='text-center py-4 text-muted'>Scanning rankings...</td></tr>";
    } catch (e) { console.error("Leaderboard Refresh Error", e); }
}

function resetUI() {
    document.getElementById('walletBalance').innerText = "-- POL";
    const refLink = document.getElementById('refLink');
    if (refLink) refLink.innerText = "Connect wallet to view...";
    document.getElementById('userAvailable').innerText = "0.000000";
    document.getElementById('userTotalStaked').innerText = "0 POL";
    document.getElementById('userWithdrawn').innerText = "0 POL";
    document.getElementById('directReferrals').innerText = "0";
    document.getElementById('totalTeam').innerText = "0";
    for(let i=1; i<=4; i++) {
        const el = document.getElementById(`lvl${i}Bonus`);
        if(el) el.innerText = "0 POL";
    }
}

// 7. Action Listeners
document.getElementById('connect-btn').addEventListener('click', toggleConnection);
const calcInp = document.getElementById('calcInput');
if(calcInp) calcInp.addEventListener('input', calculateEarnings);

document.getElementById('investBtn').addEventListener('click', async () => {
    const amountInput = document.getElementById('investAmount');
    const rawAmount = amountInput ? amountInput.value : "0";
    if (!userAddress) return toggleConnection();
    if (parseFloat(rawAmount) < 10) return Swal.fire("Error", "Minimum 10 POL required", "warning");

    try {
        const sanitizedAmount = parseFloat(rawAmount).toString();
        const amountWei = ethers.utils.parseEther(sanitizedAmount);
        const finalRef = ethers.utils.getAddress(currentReferrer.toLowerCase());
        Swal.fire({ title: 'Confirm Stake', text: `Staking ${sanitizedAmount} POL...`, allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const estimatedGas = await contract.estimateGas.invest(finalRef, { value: amountWei });
        const tx = await contract.invest(finalRef, { value: amountWei, gasLimit: estimatedGas.mul(120).div(100) });
        await tx.wait();
        triggerCelebration();
        Swal.fire("Success", "Amount Staked Successfully!", "success").then(() => refreshAllData());
    } catch (e) { Swal.fire("Failed", e.reason || e.message, "error"); }
});

document.getElementById('withdrawBtn').addEventListener('click', async () => {
    if (!userAddress) return toggleConnection();
    const available = document.getElementById('userAvailable').innerText;
    if (parseFloat(available) <= 0) return Swal.fire("Zero Balance", "You have no withdrawable dividends yet.", "info");
    try {
        Swal.fire({ title: 'Processing Payout...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const estimatedGas = await contract.estimateGas.withdraw();
        const tx = await contract.withdraw({ gasLimit: estimatedGas.mul(120).div(100) });
        await tx.wait();
        triggerCelebration();
        Swal.fire("Success", "Funds Withdrawn!", "success").then(() => refreshAllData());
    } catch (e) { Swal.fire("Failed", e.reason || e.message, "error"); }
});

window.addEventListener('DOMContentLoaded', init);
