"use client";

import { useState, useEffect } from "react";
import { useSellerWallet } from "@/hooks/useSellerWallet";
import type {
  DynamicProduct,
  CreateProductRequest,
  ProductType,
  SellerStyle,
  ChainId,
  PaymentMethod,
} from "@/lib/products";

interface ProductFormProps {
  product?: DynamicProduct; // 编辑时传入
  onSubmit: (data: CreateProductRequest, privateKey: string) => Promise<void>;
  onCancel: () => void;
}

// Fake gas fee estimates (UI display only)
const GAS_ESTIMATES: Record<ChainId, { fee: string; token: string }> = {
  polygon: { fee: "~0.01", token: "MATIC" },
  base: { fee: "~0.001", token: "ETH" },
  ethereum: { fee: "~0.005", token: "ETH" },
  zetachain: { fee: "~0.01", token: "ZETA" },
};

const CHAIN_OPTIONS: { value: ChainId; label: string; enabled: boolean }[] = [
  { value: "polygon", label: "Polygon", enabled: true },
  { value: "base", label: "Base", enabled: false },
  { value: "ethereum", label: "Ethereum", enabled: false },
];

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "USDC_BASE", label: "USDC (Base)" },
  { value: "USDC_POLYGON", label: "USDC (Polygon)" },
  { value: "ETH_BASE", label: "ETH (Base)" },
  { value: "MATIC_POLYGON", label: "MATIC (Polygon)" },
];

const STYLE_OPTIONS: { value: SellerStyle; label: string; desc: string }[] = [
  { value: "aggressive", label: "强势", desc: "坚持高价，降价幅度小" },
  { value: "pro", label: "专业", desc: "平衡价格和成交率" },
  { value: "friendly", label: "热情", desc: "更愿意让步促成交易" },
];

export function ProductForm({ product, onSubmit, onCancel }: ProductFormProps) {
  const { getWallet, generateWallet, importWallet } = useSellerWallet();
  const isEditing = !!product;

  // 表单状态
  const [name, setName] = useState(product?.name || "");
  const [type, setType] = useState<ProductType>(product?.type || "nft");
  const [description, setDescription] = useState(product?.description || "");
  const [priceUSDC, setPriceUSDC] = useState(product?.priceUSDC || "");
  const [storeName, setStoreName] = useState(product?.storeName || "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || "");

  // NFT 配置
  const [chain, setChain] = useState<ChainId>(product?.nft?.chain || "polygon");
  const [contractAddress, setContractAddress] = useState(
    product?.nft?.contractAddress || ""
  );
  const [tokenId, setTokenId] = useState(
    product?.nft?.tokenId?.toString() || ""
  );
  const [escrowAddress, setEscrowAddress] = useState(
    product?.nft?.escrowAddress || ""
  );

  // 支付方式
  const [acceptedPayments, setAcceptedPayments] = useState<PaymentMethod[]>(
    product?.acceptedPayments || ["USDC_BASE"]
  );

  // Seller Agent 配置
  const [agentName, setAgentName] = useState(
    product?.sellerAgent?.name || "卖家 Agent"
  );
  const [agentStyle, setAgentStyle] = useState<SellerStyle>(
    product?.sellerAgent?.style || "pro"
  );
  const [minPriceFactor, setMinPriceFactor] = useState(
    (product?.sellerAgent?.minPriceFactor || 0.8).toString()
  );
  const [maxDiscountPerRound, setMaxDiscountPerRound] = useState(
    (product?.sellerAgent?.maxDiscountPerRound || 0.05).toString()
  );
  const [agentPrompt, setAgentPrompt] = useState(
    product?.sellerAgent?.prompt || ""
  );

  // 钱包
  const [walletAddress, setWalletAddress] = useState(
    product?.sellerAgent?.walletAddress || ""
  );
  const [privateKey, setPrivateKey] = useState("");
  const [showPrivateKey, setShowPrivateKey] = useState(false);

  // UI 状态
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Deploy 状态
  const [needsDeploy, setNeedsDeploy] = useState(true); // true = 需要部署, false = 使用已有
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<"idle" | "minting" | "approving" | "depositing" | "done">("idle");
  const [deployTxHash, setDeployTxHash] = useState("");

  // 编辑时加载已保存的钱包
  useEffect(() => {
    if (product) {
      const savedWallet = getWallet(product.id);
      if (savedWallet) {
        setWalletAddress(savedWallet.address);
        setPrivateKey(savedWallet.privateKey);
      }
    }
  }, [product, getWallet]);

  // 生成新钱包
  const handleGenerateWallet = () => {
    const wallet = generateWallet();
    setWalletAddress(wallet.address);
    setPrivateKey(wallet.privateKey);
  };

  // 导入私钥
  const handleImportPrivateKey = (key: string) => {
    setPrivateKey(key);
    const wallet = importWallet(key);
    if (wallet) {
      setWalletAddress(wallet.address);
      setError("");
    } else {
      setWalletAddress("");
      setError("无效的私钥格式");
    }
  };

  // 切换支付方式
  const togglePayment = (method: PaymentMethod) => {
    if (acceptedPayments.includes(method)) {
      if (acceptedPayments.length > 1) {
        setAcceptedPayments(acceptedPayments.filter((m) => m !== method));
      }
    } else {
      setAcceptedPayments([...acceptedPayments, method]);
    }
  };

  // 一键部署 NFT
  const handleDeploy = async () => {
    if (!walletAddress) {
      setError("请先配置卖家钱包");
      return;
    }

    const chainOption = CHAIN_OPTIONS.find(c => c.value === chain);
    if (!chainOption?.enabled) {
      setError(`${chainOption?.label || chain} 链暂未开放，请选择 Polygon`);
      return;
    }

    setIsDeploying(true);
    setDeployStatus("minting");
    setError("");

    try {
      const res = await fetch("/api/products/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain,
          sellerAddress: walletAddress,
        }),
      });

      const result = await res.json();

      if (!result.ok) {
        throw new Error(result.error || "部署失败");
      }

      // Update form fields with deployed values
      setContractAddress(result.nftContract);
      setTokenId(result.tokenId.toString());
      setEscrowAddress(result.escrowContract);
      setDeployTxHash(result.txHash);
      setDeployStatus("done");

    } catch (err) {
      setError(err instanceof Error ? err.message : "部署失败");
      setDeployStatus("idle");
    } finally {
      setIsDeploying(false);
    }
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 验证
    if (!name.trim()) {
      setError("请输入商品名称");
      return;
    }
    if (!priceUSDC || parseFloat(priceUSDC) <= 0) {
      setError("请输入有效价格");
      return;
    }
    if (!walletAddress || !privateKey) {
      setError("请配置卖家钱包");
      return;
    }
    if (type === "nft") {
      if (needsDeploy && deployStatus !== "done") {
        setError("请先点击「一键部署」部署 NFT");
        return;
      }
      if (!contractAddress || !tokenId) {
        setError("NFT 商品需要填写合约地址和 Token ID");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const data: CreateProductRequest = {
        name: name.trim(),
        type,
        description: description.trim(),
        priceUSDC,
        imageUrl: imageUrl.trim() || undefined,
        storeName: storeName.trim() || name.trim(),
        acceptedPayments,
        sellerAgent: {
          name: agentName.trim(),
          style: agentStyle,
          walletAddress,
          minPriceFactor: parseFloat(minPriceFactor),
          maxDiscountPerRound: parseFloat(maxDiscountPerRound),
          prompt: agentPrompt.trim() || undefined,
        },
        ...(type === "nft" && {
          nft: {
            chain,
            contractAddress,
            tokenId: parseInt(tokenId),
            escrowAddress: escrowAddress || undefined,
          },
        }),
      };

      await onSubmit(data, privateKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 基本信息 */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white/90">商品信息</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">商品名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
              placeholder="例如：量子之剑（NFT）"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">店铺名称</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
              placeholder="例如：我的武器店"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">商品类型</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ProductType)}
              className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-white"
            >
              <option value="nft" className="bg-[#1a1a2e] text-white">NFT</option>
              <option value="digital" className="bg-[#1a1a2e] text-white">数字商品</option>
              <option value="physical" className="bg-[#1a1a2e] text-white">实体商品</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">价格 (USDC)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={priceUSDC}
              onChange={(e) => setPriceUSDC(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
              placeholder="0.50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-1">商品描述</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
            placeholder="描述你的商品..."
          />
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-1">
            商品图片 URL
            <span className="text-white/40 ml-1">(可选)</span>
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
            placeholder="https://example.com/image.jpg"
          />
          {imageUrl && (
            <div className="mt-2 w-20 h-20 rounded-lg overflow-hidden border border-white/10">
              <img
                src={imageUrl}
                alt="预览"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* NFT 配置 */}
      {type === "nft" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-white/90">NFT 配置</h3>
            {deployStatus === "done" && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                已部署
              </span>
            )}
          </div>

          {/* 选择模式：使用已有 or 一键部署 */}
          {!isEditing && deployStatus !== "done" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNeedsDeploy(false)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
                  !needsDeploy
                    ? "bg-blue-500/20 border border-blue-400/50 text-blue-300"
                    : "bg-white/5 border border-white/10 text-white/60 hover:text-white/80"
                }`}
              >
                使用已有 NFT
              </button>
              <button
                type="button"
                onClick={() => setNeedsDeploy(true)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm transition-all ${
                  needsDeploy
                    ? "bg-purple-500/20 border border-purple-400/50 text-purple-300"
                    : "bg-white/5 border border-white/10 text-white/60 hover:text-white/80"
                }`}
              >
                一键部署新 NFT
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">链</label>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value as ChainId)}
                className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-white"
                disabled={deployStatus === "done"}
              >
                {CHAIN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-[#1a1a2e] text-white">
                    {opt.label} {!opt.enabled && "(即将支持)"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-1">Token ID</label>
              <input
                type="number"
                min="0"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
                placeholder={needsDeploy ? "自动生成" : "输入 Token ID"}
                readOnly={deployStatus === "done"}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">NFT 合约地址</label>
            <input
              type="text"
              value={contractAddress}
              onChange={(e) => setContractAddress(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm"
              placeholder={needsDeploy ? "部署后自动填充" : "0x..."}
              readOnly={deployStatus === "done"}
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">
              Escrow 合约地址{" "}
              <span className="text-white/40">(NFT 托管合约)</span>
            </label>
            <input
              type="text"
              value={escrowAddress}
              onChange={(e) => setEscrowAddress(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm"
              placeholder={needsDeploy ? "部署后自动填充" : "0x... (可选)"}
              readOnly={deployStatus === "done"}
            />
          </div>

          {/* 一键部署按钮 - 仅在选择部署模式时显示 */}
          {!isEditing && needsDeploy && deployStatus !== "done" && (
            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-white/90">一键部署 NFT</div>
                  <div className="text-xs text-white/50 mt-0.5">
                    自动铸造 NFT 并存入托管合约
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-white/40">预估 Gas</div>
                  <div className="text-sm text-purple-300">
                    {GAS_ESTIMATES[chain]?.fee || "~0.01"} {GAS_ESTIMATES[chain]?.token || ""}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDeploy}
                disabled={isDeploying || !walletAddress}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium hover:from-purple-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isDeploying ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {deployStatus === "minting" && "铸造 NFT 中..."}
                    {deployStatus === "approving" && "授权托管合约..."}
                    {deployStatus === "depositing" && "存入托管..."}
                  </span>
                ) : (
                  "一键部署"
                )}
              </button>

              {!walletAddress && (
                <p className="text-xs text-yellow-400/80 mt-2 text-center">
                  请先在下方配置卖家钱包
                </p>
              )}
            </div>
          )}

          {/* 部署成功信息 */}
          {deployStatus === "done" && deployTxHash && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-emerald-300 mb-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                NFT 已部署成功
              </div>
              <a
                href={`https://amoy.polygonscan.com/tx/${deployTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-400/70 hover:text-emerald-300 font-mono truncate block"
              >
                查看交易: {deployTxHash.slice(0, 20)}...
              </a>
            </div>
          )}
        </div>
      )}

      {/* 支付方式 */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white/90">接受的支付方式</h3>

        <div className="flex flex-wrap gap-2">
          {PAYMENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => togglePayment(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                acceptedPayments.includes(opt.value)
                  ? "bg-blue-500/20 border border-blue-400/50 text-blue-300"
                  : "bg-white/5 border border-white/10 text-white/60 hover:text-white/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Seller Agent 配置 */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-white/90">Seller Agent 配置</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">Agent 名称</label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
              placeholder="卖家 Agent"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">销售风格</label>
            <select
              value={agentStyle}
              onChange={(e) => setAgentStyle(e.target.value as SellerStyle)}
              className="w-full bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-white"
            >
              {STYLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#1a1a2e] text-white">
                  {opt.label} - {opt.desc}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/70 mb-1">
              最低价格系数
              <span className="text-white/40 ml-1">(0.7 = 最低7折)</span>
            </label>
            <input
              type="number"
              step="0.05"
              min="0.5"
              max="1"
              value={minPriceFactor}
              onChange={(e) => setMinPriceFactor(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">
              每轮最大降价
              <span className="text-white/40 ml-1">(0.05 = 5%)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="0.2"
              value={maxDiscountPerRound}
              onChange={(e) => setMaxDiscountPerRound(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-1">
            自定义降价策略 Prompt
            <span className="text-white/40 ml-1">(可选)</span>
          </label>
          <textarea
            value={agentPrompt}
            onChange={(e) => setAgentPrompt(e.target.value)}
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
            placeholder="例如：
- 第一次问价只降 2%
- 如果买家说「太贵了」再降 3%
- 最多降到 85 折就坚持不降
- 如果买家犹豫就送个小礼物"
          />
          <p className="mt-1 text-xs text-white/40">
            定义你的 AI 卖家如何与买家议价，支持自然语言描述
          </p>
        </div>
      </div>

      {/* 钱包配置 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-white/90">Seller Agent 钱包</h3>
          <button
            type="button"
            onClick={handleGenerateWallet}
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            生成新钱包
          </button>
        </div>

        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm text-yellow-200/80">
          私钥仅存储在您的浏览器本地，不会上传到服务器。未来将支持 MetaMask 签名。
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-1">钱包地址</label>
          <input
            type="text"
            value={walletAddress}
            readOnly
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/60 font-mono text-sm"
            placeholder="生成或导入钱包后显示"
          />
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-1">
            私钥
            <button
              type="button"
              onClick={() => setShowPrivateKey(!showPrivateKey)}
              className="ml-2 text-blue-400 hover:text-blue-300"
            >
              {showPrivateKey ? "隐藏" : "显示"}
            </button>
          </label>
          <input
            type={showPrivateKey ? "text" : "password"}
            value={privateKey}
            onChange={(e) => handleImportPrivateKey(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm"
            placeholder="输入私钥或点击生成新钱包"
          />
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3 justify-end pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 disabled:opacity-50"
        >
          {isSubmitting ? "提交中..." : isEditing ? "保存修改" : "上架商品"}
        </button>
      </div>
    </form>
  );
}
