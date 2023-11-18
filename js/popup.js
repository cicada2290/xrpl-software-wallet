const NETWORK_URLS = {
  TESTNET: "wss://s.altnet.rippletest.net:51233/",
  DEVNET: "wss://s.devnet.rippletest.net:51233/",
  AMM_DEVNET: "wss://amm.devnet.rippletest.net:51233/"
};

async function getStorageItem(key, defaultValue = "") {
  const result = await chrome.storage.local.get([key]);
  return result[key] || defaultValue;
}

async function setStorageItem(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

function setElementVisibility(elementId, isVisible) {
  document.getElementById(elementId).style.display = isVisible ? 'block' : 'none';
}

// ページの表示状態を切り替える関数
function switchPageVisibility(showMain) {
  setElementVisibility('mainPage', showMain);
  setElementVisibility('mainPageFooter', showMain);
  setElementVisibility('importPage', !showMain);
  setElementVisibility('importPageFooter', !showMain);
}

async function connectToXrplClient() {
  const network = await getStorageItem("network", 'TESTNET');
  const xrplClient = new xrpl.Client(NETWORK_URLS[network]);
  await xrplClient.connect();
  return xrplClient;
}

async function fetchXrpBalance() {
  try {
    const xrplClient = await connectToXrplClient();
    const address = await getStorageItem("walletAddress", '');

    if (address) {
      const balance = await xrplClient.getXrpBalance(address);
      document.getElementById('nativeTokenBalanceDisplay').textContent = Number(balance).toLocaleString();
    } else {
      document.getElementById('nativeTokenBalanceDisplay').textContent = "0";
    }

    await xrplClient.disconnect();
  } catch (error) {
    console.error(error);
    // 適切なエラー処理をここに追加
  }
}

// ページの表示状態を切り替える関数
async function updateUI() {
  try {
    const walletAddress = await getStorageItem("walletAddress", 'No address set');
    document.getElementById('walletAddressDisplay').textContent = walletAddress;
    document.getElementById('networkSelect').value = await getStorageItem("network", 'TESTNET');
    const hasAddress = walletAddress !== 'No address set';

    setElementVisibility('goToImportPageButton', !hasAddress);
    setElementVisibility('createWalletButton', !hasAddress);
    setElementVisibility('deleteWalletButton', hasAddress);
    setElementVisibility('showSeedButton', hasAddress);

    if (hasAddress) {
      await fetchXrpBalance()
    } else {
      document.getElementById('nativeTokenBalanceDisplay').textContent = "0";
    };
  } catch (error) {
    console.error(error);
    // エラーメッセージの表示等の処理をここに追加
  }
}

const selectElement = document.getElementById('networkSelect');
selectElement.addEventListener('change', async function() {
  const selectedValue = selectElement.value;
  await setStorageItem("network", selectedValue);
});

// ボタンのイベントリスナーを設定する関数
function setupButtonListeners() {
  document.getElementById('goToMainPageButton').addEventListener('click', async () => {
    switchPageVisibility(true);
    await updateUI();
  });

  document.getElementById('goToImportPageButton').addEventListener('click', () => {
    switchPageVisibility(false);
  });

  document.getElementById('importWalletButton').addEventListener('click', async () => {
    try {
      setElementVisibility('errorMessage', false);
      setElementVisibility('loadingIndicator', true);

      const seedPhrase = document.getElementById('seedPhraseInput').value;

      const xrplClient = await connectToXrplClient();
    
      const newWallet = xrpl.Wallet.fromSecret(seedPhrase);
      await setStorageItem("walletAddress", newWallet.address);
      await setStorageItem("walletSeed", seedPhrase);
    
      await xrplClient.disconnect();
      setElementVisibility('loadingIndicator', false);
    
      await updateUI();

      document.getElementById('seedPhraseInput').value = "";
      switchPageVisibility(true);
    } catch (error) {
      document.getElementById('errorMessage').textContent = "Failed to retrieve data.";
      setElementVisibility('errorMessage', true);
      setElementVisibility('loadingIndicator', false);
    }
  });

  document.getElementById('createWalletButton').addEventListener('click', async () => {
    try {
      document.getElementById('walletAddressDisplay').textContent = "Generating...";

      const xrplClient = await connectToXrplClient();
      const { balance, wallet } = await xrplClient.fundWallet();
      await xrplClient.disconnect();

      await setStorageItem("walletAddress", wallet.address);
      await setStorageItem("walletSeed", wallet.seed);
      await updateUI();
      document.getElementById('nativeTokenBalanceDisplay').textContent = balance.toLocaleString();
      setElementVisibility('createWalletButton', false);

    } catch(error) {
      console.error(error);
      document.getElementById('walletAddressDisplay').textContent = "Failed to generate wallet.";
    }
  });

  document.getElementById('deleteWalletButton').addEventListener('click', async () => {
    await setStorageItem("walletAddress", "");
    await setStorageItem("walletSeed", "");
    await updateUI();
  });

  document.getElementById('showSeedButton').addEventListener('click', async () => {
    const seed = await getStorageItem("walletSeed", "");
    const seedDisplayElement = document.getElementById('walletSeedDisplay');
    const countdownElement = document.getElementById('countdownTimer');
  
    seedDisplayElement.textContent = seed;
    setElementVisibility('walletSeedDisplay', true);
    
    let countdown = 5;
    countdownElement.textContent = `Countdown: ${countdown} seconds`;
  
    const interval = setInterval(() => {
      countdown -= 1;
      countdownElement.textContent = `Countdown: ${countdown} seconds`;
    }, 1000);
  
    setTimeout(() => {
      setElementVisibility('walletSeedDisplay', false);
      clearInterval(interval);
      countdownElement.textContent = '';
    }, 5000);
  });
}

document.addEventListener("DOMContentLoaded", updateUI);
setupButtonListeners();
