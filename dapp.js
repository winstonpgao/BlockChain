// dapp.js
const contract_address = "0x763326819ef8fd986a806f2b23e32ab0cb24c9a2";
const dApp = {
  ethEnabled: function() {
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      window.ethereum.enable();
      return true;
    }
    return false;
  },

  updateUI: function() {
    const renderItem = (copyright_id, reference_uri, icon_class, { description, image }) => `
      <li>
        <div class="collapsible-header"><i class="${icon_class}"></i> ${description}</div>
        <div class="collapsible-body">
          <strong>ID:</strong> ${copyright_id}<br/>
          <strong>Description:</strong> ${description}<br/>
          <strong>URI:</strong> ${reference_uri}<br/>
          <strong>Gateway:</strong>
          <a href="https://gateway.pinata.cloud/ipfs/${reference_uri.replace("ipfs://","")}" target="_blank">
            gateway.pinata.cloud/ipfs/${reference_uri.replace("ipfs://","")}
          </a><br/>
          <img src="https://gateway.pinata.cloud/ipfs/${image.replace("ipfs://","")}" style="width:100%; margin-top:1rem"/>
        </div>
      </li>
    `;

    const fetchMetadata = uri =>
      fetch(`https://gateway.pinata.cloud/ipfs/${uri.replace("ipfs://","")}`)
        .then(r => r.json());

    // Copyright events
    this.contract.events.Copyright({fromBlock:0})
      .on("data", e => {
        fetchMetadata(e.returnValues.reference_uri)
          .then(json => {
            $("#dapp-copyrights")
              .append(renderItem(
                e.returnValues.copyright_id,
                e.returnValues.reference_uri,
                "far fa-copyright",
                json
              ));
          });
      });

    // OpenSource events
    this.contract.events.OpenSource({fromBlock:0})
      .on("data", e => {
        fetchMetadata(e.returnValues.reference_uri)
          .then(json => {
            $("#dapp-opensource")
              .append(renderItem(
                e.returnValues.copyright_id,
                e.returnValues.reference_uri,
                "fab fa-osi",
                json
              ));
          });
      });

    // Transfer events (just log or you could update a log area)
    this.contract.events.Transfer({fromBlock:0})
      .on("data", e => {
        console.log("Transfer:", e.returnValues);
      });
  },

  // MINT or OPEN SOURCE
  copyrightWork: async function() {
    /* unchanged from your existing code */
  },

  // LOOKUP mapping
  fetchCopyright: async function() {
    const id = $("#copyright-id-input").val();
    if (!id) return M.toast({ html: "Enter an ID" });
    try {
      const { owner, uri } = await this.contract.methods.copyrights(id).call();
      $("#copyright-details").html(`
        <p><strong>Owner:</strong> ${owner}</p>
        <p><strong>URI:</strong> ${uri}</p>
        <p><strong>Gateway:</strong>
          <a href="https://gateway.pinata.cloud/ipfs/${uri.replace("ipfs://","")}" target="_blank">
            gateway.pinata.cloud/ipfs/${uri.replace("ipfs://","")}
          </a>
        </p>
      `);
    } catch {
      M.toast({ html: "Error fetching data" });
    }
  },

  // TRANSFER
  transferCopyright: async function() {
    const id = $("#transfer-id-input").val();
    const newOwner = $("#transfer-owner-input").val();
    if (!id || !newOwner) return M.toast({ html: "Fill both fields" });
    this.contract.methods
      .transferCopyrightOwnership(id, newOwner)
      .send({ from: this.accounts[0] })
      .on("receipt", () => {
        M.toast({ html: "Ownership Transferred" });
        location.reload();
      });
  },

  // RENOUNCE
  renounceCopyright: async function() {
    const id = $("#renounce-id-input").val();
    if (!id) return M.toast({ html: "Enter an ID" });
    this.contract.methods
      .renounceCopyrightOwnership(id)
      .send({ from: this.accounts[0] })
      .on("receipt", () => {
        M.toast({ html: "Ownership Renounced" });
        location.reload();
      });
  },

  main: async function() {
    if (!this.ethEnabled()) {
      return alert("Please install MetaMask!");
    }
    this.accounts = await window.web3.eth.getAccounts();
    this.cryptoRightABI = await (await fetch("./CryptoRight.json")).json();
    this.contract = new web3.eth.Contract(
      this.cryptoRightABI,
      contract_address,
      { defaultAccount: this.accounts[0] }
    );
    this.updateUI();
  }
};

dApp.main();
