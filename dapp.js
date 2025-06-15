const contract_address = "0x763326819ef8fd986a806f2b23e32ab0cb24c9a2";

const dApp = {
  ethEnabled: function () {
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      window.ethereum.enable();
      return true;
    }
    return false;
  },

  updateUI: async function () {
    // Clear lists before reload
    $("#dapp-opensource").html('');
    $("#dapp-copyrights").html('');

    // Find all copyrights sequentially (brute force, ok for demo)
    let i = 1, empty = 0;
    const maxEmpty = 5; // if 5 consecutive empty slots, break (optimistic end)

    while (empty < maxEmpty) {
      try {
        const work = await this.contract.methods.copyrights(i).call();
        if (work && work.owner && work.uri) {
          empty = 0; // reset empty streak
          const metadata = await this.fetchMetadata(work.uri);
          const name = metadata?.name || metadata?.pinataContent?.name || '';
          const desc = metadata?.description || metadata?.pinataContent?.description || '';
          const img = metadata?.image || metadata?.pinataContent?.image || '';
          const imgTag = img ? `<img src="https://gateway.pinata.cloud/ipfs/${img.replace('ipfs://', '')}" style="width:100%;max-width:320px; margin-top:8px;border-radius:10px;">` : '';
          const ref = work.uri ? `<a href="https://gateway.pinata.cloud/ipfs/${work.uri.replace('ipfs://','')}" target="_blank">${work.uri}</a>` : '';

          const itemHtml = `
            <li>
              <div class="collapsible-header"><i class="far fa-copyright"></i> Copyright #${i}: ${name}</div>
              <div class="collapsible-body">
                <b>Description:</b> ${desc}<br/>
                ${imgTag}
                <div style="margin-top:6px;"><b>Owner:</b> ${work.owner}</div>
                <div><b>Reference:</b> ${ref}</div>
              </div>
            </li>
          `;
          // If open sourced (owner = 0x0) put in open source, else proprietary
          if (work.owner === "0x0000000000000000000000000000000000000000") {
            $("#dapp-opensource").append(itemHtml);
          } else {
            $("#dapp-copyrights").append(itemHtml);
          }
        } else {
          empty++;
        }
      } catch {
        empty++;
      }
      i++;
    }
  },

  fetchMetadata: async function (uri) {
    try {
      const resp = await fetch(`https://gateway.pinata.cloud/ipfs/${uri.replace("ipfs://", "")}`);
      if (!resp.ok) return {};
      const json = await resp.json();
      // handle pinata wrapper
      return json.pinataContent || json;
    } catch { return {}; }
  },

  copyrightWork: async function () {
    const name = $("#dapp-copyright-name").val();
    const description = $("#dapp-copyright-description").val();
    const image = document.getElementById("dapp-copyright-image");
    const pinata_api_key = $("#dapp-pinata-api-key").val();
    const pinata_secret_api_key = $("#dapp-pinata-secret-api-key").val();

    if (!pinata_api_key || !pinata_secret_api_key || !name || !description || !image.files[0]) {
      M.toast({ html: "Please fill all fields including image!" });
      return;
    }

    // 1. Upload image to Pinata
    const image_data = new FormData();
    image_data.append("file", image.files[0]);
    image_data.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

    try {
      M.toast({ html: "Uploading image to IPFS..." });
      const imgResp = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
        method: "POST",
        mode: "cors",
        headers: { pinata_api_key, pinata_secret_api_key },
        body: image_data,
      });
      const imgHash = await imgResp.json();
      const image_uri = `ipfs://${imgHash.IpfsHash}`;

      // 2. Upload metadata JSON
      const ref_json = JSON.stringify({
        name, description, image: image_uri
      });
      M.toast({ html: "Uploading metadata to IPFS..." });

      const metaResp = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json", pinata_api_key, pinata_secret_api_key },
        body: ref_json,
      });
      const metaHash = await metaResp.json();
      const reference_uri = `ipfs://${metaHash.IpfsHash}`;

      // 3. Call contract
      M.toast({ html: "Submitting transaction..." });
      if ($("#dapp-opensource-toggle").prop("checked")) {
        this.contract.methods.openSourceWork(reference_uri).send({ from: this.accounts[0] })
          .on("receipt", () => { M.toast({ html: "Minted open source work!" }); location.reload(); });
      } else {
        this.contract.methods.copyrightWork(reference_uri).send({ from: this.accounts[0] })
          .on("receipt", () => { M.toast({ html: "Minted proprietary copyright!" }); location.reload(); });
      }
    } catch (e) {
      alert("ERROR: " + (e?.message || e));
    }
  },

  fetchCopyright: async function () {
    const id = $("#copyright-id-input").val();
    if (!id || isNaN(id)) return;
    try {
      const work = await this.contract.methods.copyrights(id).call();
      if (!work || (!work.owner && !work.uri)) {
        $("#copyright-details").html("<span class='red-text'>Not found.</span>");
        return;
      }
      const meta = await this.fetchMetadata(work.uri);
      const name = meta?.name || meta?.pinataContent?.name || '';
      const desc = meta?.description || meta?.pinataContent?.description || '';
      const img = meta?.image || meta?.pinataContent?.image || '';
      const imgTag = img ? `<img src="https://gateway.pinata.cloud/ipfs/${img.replace('ipfs://','')}" style="max-width:200px; border-radius:8px;">` : '';
      $("#copyright-details").html(`
        <b>Name:</b> ${name}<br/>
        <b>Description:</b> ${desc}<br/>
        ${imgTag}
        <br/><b>Owner:</b> ${work.owner}<br/>
        <b>Reference:</b> <a href="https://gateway.pinata.cloud/ipfs/${work.uri.replace('ipfs://','')}" target="_blank">${work.uri}</a>
      `);
    } catch (e) {
      $("#copyright-details").html("<span class='red-text'>Error fetching copyright.</span>");
    }
  },

  transferCopyright: async function () {
    const id = $("#transfer-id-input").val();
    const newOwner = $("#transfer-owner-input").val();
    if (!id || !window.web3.utils.isAddress(newOwner)) {
      M.toast({ html: "Valid copyright ID and address required" });
      return;
    }
    try {
      this.contract.methods.transferCopyrightOwnership(id, newOwner).send({ from: this.accounts[0] })
        .on("receipt", () => { M.toast({ html: "Ownership transferred!" }); location.reload(); });
    } catch (e) {
      alert("ERROR: " + (e?.message || e));
    }
  },

  renounceCopyright: async function () {
    const id = $("#renounce-id-input").val();
    if (!id) {
      M.toast({ html: "Copyright ID required" });
      return;
    }
    if (!confirm("Renounce? This is permanent!")) return;
    try {
      this.contract.methods.renounceCopyrightOwnership(id).send({ from: this.accounts[0] })
        .on("receipt", () => { M.toast({ html: "Ownership renounced (open sourced)!" }); location.reload(); });
    } catch (e) {
      alert("ERROR: " + (e?.message || e));
    }
  },

  main: async function () {
    if (!this.ethEnabled()) {
      alert("Please install MetaMask to use this dApp!");
    }
    this.accounts = await window.web3.eth.getAccounts();
    this.cryptoRightABI = await (await fetch("./CryptoRight.json")).json();
    this.contract = new window.web3.eth.Contract(
      this.cryptoRightABI,
      contract_address,
      { defaultAccount: this.accounts[0] }
    );
    this.updateUI();
  }
};

dApp.main();
