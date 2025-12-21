/**
 * Single Product API
 *
 * GET    /api/products/[id] - 获取单个商品
 * PUT    /api/products/[id] - 更新商品
 * DELETE /api/products/[id] - 删除商品
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getProductById,
  updateProduct,
  deleteProduct,
  deactivateProduct,
} from "@/lib/productService";
import type { UpdateProductRequest } from "@/lib/products";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const product = getProductById(id);

    if (!product) {
      return NextResponse.json(
        { ok: false, error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      product,
    });
  } catch (error) {
    console.error("[API] GET /api/products/[id] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch product" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateProductRequest;

    const product = updateProduct(id, body);

    if (!product) {
      return NextResponse.json(
        { ok: false, error: "Product not found" },
        { status: 404 }
      );
    }

    console.log(`[API] Updated product: ${product.id} - ${product.name}`);

    return NextResponse.json({
      ok: true,
      product,
    });
  } catch (error) {
    console.error("[API] PUT /api/products/[id] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to update product" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get("permanent") === "true";

    let success: boolean;
    if (permanent) {
      success = deleteProduct(id);
    } else {
      // 默认只是 deactivate
      success = deactivateProduct(id);
    }

    if (!success) {
      return NextResponse.json(
        { ok: false, error: "Product not found" },
        { status: 404 }
      );
    }

    console.log(
      `[API] ${permanent ? "Deleted" : "Deactivated"} product: ${id}`
    );

    return NextResponse.json({
      ok: true,
      message: permanent ? "Product deleted" : "Product deactivated",
    });
  } catch (error) {
    console.error("[API] DELETE /api/products/[id] error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
