/**
 * Products API
 *
 * GET  /api/products - 获取所有商品
 * POST /api/products - 创建新商品
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAllProducts,
  getActiveProducts,
  createProduct,
} from "@/lib/productService";
import type { CreateProductRequest } from "@/lib/products";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    const products = includeInactive ? getAllProducts() : getActiveProducts();

    return NextResponse.json({
      ok: true,
      products,
      count: products.length,
    });
  } catch (error) {
    console.error("[API] GET /api/products error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateProductRequest;

    // 基本验证
    if (!body.name || !body.type || !body.priceUSDC) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields: name, type, priceUSDC" },
        { status: 400 }
      );
    }

    if (!body.sellerAgent?.walletAddress) {
      return NextResponse.json(
        { ok: false, error: "Missing seller agent wallet address" },
        { status: 400 }
      );
    }

    // NFT 类型需要额外字段
    if (body.type === "nft") {
      if (!body.nft?.contractAddress || body.nft?.tokenId === undefined) {
        return NextResponse.json(
          {
            ok: false,
            error: "NFT products require nft.contractAddress and nft.tokenId",
          },
          { status: 400 }
        );
      }
    }

    const product = createProduct(body);

    console.log(`[API] Created product: ${product.id} - ${product.name}`);

    return NextResponse.json({
      ok: true,
      product,
    });
  } catch (error) {
    console.error("[API] POST /api/products error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create product" },
      { status: 500 }
    );
  }
}
