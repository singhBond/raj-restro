"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, Timestamp } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// === Interfaces ===
interface Product {
  id: string;
  name: string;
  price: number;
  halfPrice?: number;
  quantity?: string;
  description?: string;
  imageUrl?: string;
  imageUrls?: string[];
  createdAt?: Timestamp;
  isVeg: boolean;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  halfPrice?: number;
  quantity: number;
  portion: "half" | "full";
  description?: string;
  imageUrl?: string;
  imageUrls?: string[];
  isVeg: boolean;
  serves?: string;
}

interface Category {
  id: string;
  name: string;
  imageUrl?: string;
  createdAt?: Timestamp;
}

// === Skeleton Components ===
const SkeletonCard = () => (
  <div className="animate-pulse">
    <div className="bg-gray-200 border-2 border-dashed rounded-xl w-full h-56" />
    <div className="py-2 px-4">
      <div className="h-6 bg-gray-200 rounded w-3/4 mt-3" />
      <div className="h-5 bg-gray-200 rounded w-1/2 mt-3" />
    </div>
  </div>
);

const SkeletonCategory = () => (
  <div className="flex flex-col items-center animate-pulse mb-2">
    <div className="w-14 h-14 bg-gray-200 rounded-lg" />
    <div className="h-4 bg-gray-200 rounded w-16 mt-2" />
  </div>
);

// === Read More Component ===
const DescriptionWithReadMore: React.FC<{ text: string }> = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxLength = 120;

  if (!text || text.length <= maxLength) {
    return <p className="text-sm text-gray-700">{text}</p>;
  }

  return (
    <div>
      <p className={`text-sm text-gray-700 ${isExpanded ? "" : "line-clamp-3"}`}>
        {isExpanded ? text : `${text.slice(0, maxLength)}...`}
      </p>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-red-600 font-medium text-sm mt-1 hover:underline"
      >
        {isExpanded ? "Read less" : "Read more"}
      </button>
    </div>
  );
};

// === Main Component ===
const FastFoodCatalogue: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [productsByCat, setProductsByCat] = useState<Record<string, Product[]>>({});
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [successOpen, setSuccessOpen] = useState<boolean>(false);
  const [orderId, setOrderId] = useState<string>("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [filter, setFilter] = useState<"all" | "veg" | "nonveg">("all");

  // Loading States
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Reset image index
  useEffect(() => {
    setCurrentImageIndex(0);
  }, [selectedProduct]);

  // === Load Categories ===
  useEffect(() => {
    setLoadingCategories(true);
    const q = query(collection(db, "categories"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const fetchedCategories: Category[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            name: data.name || "Unnamed",
            imageUrl: data.imageUrl || "",
            createdAt: data.createdAt,
          };
        });

        const sorted = fetchedCategories.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        });

        setCategories(sorted);
        setLoadingCategories(false);

        if (sorted.length > 0 && !activeCategory) {
          setActiveCategory(sorted[0].id);
        }
      },
      (error) => {
        console.error("Error fetching categories:", error);
        setLoadingCategories(false);
      }
    );

    return () => unsub();
  }, []);

  // === Load Products ===
  useEffect(() => {
    if (categories.length === 0) {
      setLoadingProducts(true);
      return;
    }

    setLoadingProducts(true);
    const unsubs: (() => void)[] = [];

    categories.forEach((cat) => {
      const q = query(collection(db, "categories", cat.id, "products"));
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const fetchedProducts: Product[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            const imageUrls =
              data.imageUrls || (data.imageUrl ? [data.imageUrl] : []);
            return {
              id: docSnap.id,
              name: data.name || "Unnamed Product",
              price: data.price || 0,
              halfPrice: data.halfPrice,
              quantity: data.quantity || "1",
              description: data.description,
              imageUrl: data.imageUrl || "",
              imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
              createdAt: data.createdAt,
              isVeg: data.isVeg ?? true,
            };
          });

          const sorted = fetchedProducts.sort((a, b) => {
            if (!a.createdAt || !b.createdAt) return 0;
            return b.createdAt.toMillis() - a.createdAt.toMillis();
          });

          setProductsByCat((prev) => ({ ...prev, [cat.id]: sorted }));
        },
        (error) => {
          console.error(`Error fetching products for ${cat.name}:`, error);
        }
      );
      unsubs.push(unsub);
    });

    const timer = setTimeout(() => setLoadingProducts(false), 800);
    return () => {
      clearTimeout(timer);
      unsubs.forEach((unsub) => unsub());
    };
  }, [categories]);

  // === Cart Persistence ===
  useEffect(() => {
    const saved = localStorage.getItem("fastfood_cart");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCart(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error("Corrupted cart data", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("fastfood_cart", JSON.stringify(cart));
  }, [cart]);

  // === Cart Actions ===
  const [tempQuantity, setTempQuantity] = useState(1);
  const [tempPortion, setTempPortion] = useState<"half" | "full">("full");

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    const price =
      tempPortion === "half"
        ? selectedProduct.halfPrice || selectedProduct.price / 2
        : selectedProduct.price;

    const newItem: CartItem = {
      id: selectedProduct.id,
      name: selectedProduct.name,
      price,
      halfPrice: selectedProduct.halfPrice,
      quantity: tempQuantity,
      portion: tempPortion,
      description: selectedProduct.description,
      imageUrl: selectedProduct.imageUrl,
      imageUrls: selectedProduct.imageUrls,
      isVeg: selectedProduct.isVeg,
      serves: selectedProduct.quantity,
    };

    setCart((prev) => {
      const exists = prev.find(
        (i) => i.id === newItem.id && i.portion === newItem.portion
      );
      if (exists) {
        return prev.map((i) =>
          i.id === newItem.id && i.portion === newItem.portion
            ? { ...i, quantity: i.quantity + tempQuantity }
            : i
        );
      }
      return [...prev, newItem];
    });

    setSelectedProduct(null);
    setTempQuantity(1);
    setTempPortion("full");
  };

  const increaseQty = (id: string, portion: "half" | "full") =>
    setCart((prev) =>
      prev.map((i) =>
        i.id === id && i.portion === portion
          ? { ...i, quantity: i.quantity + 1 }
          : i
      )
    );

  const decreaseQty = (id: string, portion: "half" | "full") =>
    setCart((prev) =>
      prev
        .map((i) =>
          i.id === id && i.portion === portion
            ? { ...i, quantity: Math.max(1, i.quantity - 1) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );

  const removeFromCart = (id: string, portion: "half" | "full") =>
    setCart((prev) =>
      prev.filter((i) => !(i.id === id && i.portion === portion))
    );

  const handleProceedToBuy = () => {
    if (cart.length === 0) return;

    const totalAmount = cart.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0
    );
    const orderDetails = cart
      .map((item) => {
        const portionLabel = item.portion === "half" ? " (Half)" : " (Full)";
        const qtyLabel = item.quantity > 1 ? ` x${item.quantity}` : "";
        const serves =
          item.serves && item.serves !== "1" ? ` [${item.serves}]` : "";
        return `*${item.name}${portionLabel}${serves}${qtyLabel}* — ₹${(
          item.price * item.quantity
        ).toFixed(2)}`;
      })
      .join("\n");

    const newOrderId = `RJ-${Math.floor(100000 + Math.random() * 900000)}`;
    setOrderId(newOrderId);

    const message = `*New Order - Raj Family Restaurant*\n\n*Order ID:* ${newOrderId}\n\n${orderDetails}\n\n*Total: ₹${totalAmount.toFixed(
      2
    )}*\n\nPlease confirm my order.`;

    window.open(
      `https://wa.me/916200656377?text=${encodeURIComponent(message)}`,
      "_blank"
    );

    setCart([]);
    localStorage.removeItem("fastfood_cart");
    setCartOpen(false);
    setSuccessOpen(true);
  };

  const currentCategoryName =
    categories.find((cat) => cat.id === activeCategory)?.name || "Menu";

  const currentProducts = (productsByCat[activeCategory] || []).filter((p) => {
    if (filter === "veg") return p.isVeg;
    if (filter === "nonveg") return !p.isVeg;
    return true;
  });

  const totalAmount = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  const getImageArray = (product: Product): string[] => {
    if (product.imageUrls && product.imageUrls.length > 0) {
      return product.imageUrls.filter((url) => url && url.trim() !== "");
    }
    return product.imageUrl && product.imageUrl.trim() !== ""
      ? [product.imageUrl]
      : ["/placeholder.svg"];
  };

  const navigateImage = (direction: "prev" | "next") => {
    if (!selectedProduct) return;
    const images = getImageArray(selectedProduct);
    setCurrentImageIndex((prev) => {
      if (direction === "prev") {
        return prev === 0 ? images.length - 1 : prev - 1;
      }
      return prev === images.length - 1 ? 0 : prev + 1;
    });
  };

  // Full page loader while categories load
  if (loadingCategories) {
    return (
      <section className="min-h-screen bg-gradient-to-b from-yellow-100 to-white flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-8 border-yellow-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-6 text-xl font-semibold text-gray-700">Loading menu...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-linear-to-b from-yellow-50 to-white relative">
      {/* Header */}
      <div className="flex flex-col items-center text-center py-2 bg-linear-to-r from-yellow-800 via-yellow-500 to-yellow-800">
        <img src="logo.png" className="h-20 rounded-full shadow-lg" alt="Raj Family Restaurant" />
        <h1 className="text-4xl md:text-6xl font-extrabold text-yellow-100 mt-2">
          Raj Family Restaurant
        </h1>
        <h2 className="text-2xl md:text-4xl font-bold text-white mt-2">
          Fast • Tasty • Fresh
        </h2>
        <p className="text-black max-w-2xl mt-2 text-lg font-semibold">
           Mob: 6200656377
        </p>
        <p className="text-yellow-50 max-w-2xl mt-1 text-sm md:text-md">
          ~Accepting Online Orders : 10:00 AM - 9:00 PM~
        </p>
      </div>

      {/* Veg/Non-Veg Filter */}
      <div className="flex justify-center gap-3 py-4 bg-white shadow-sm sticky top-0 z-30">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          className={`flex items-center gap-2 ${filter === "all" ? "bg-yellow-600 hover:bg-yellow-700" : ""}`}
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        <Button
          variant={filter === "veg" ? "default" : "outline"}
          className={`flex items-center gap-2 ${filter === "veg" ? "bg-green-600 hover:bg-green-700" : ""}`}
          onClick={() => setFilter("veg")}
        >
          <span className="w-4 h-4 border-2 border-green-600 bg-green-500 rounded-sm flex items-center justify-center">
            <span className="w-2 h-2 bg-white rounded-full"></span>
          </span>
          Veg
        </Button>
        <Button
          variant={filter === "nonveg" ? "default" : "outline"}
          className={`flex items-center gap-2 ${filter === "nonveg" ? "bg-red-600 hover:bg-red-700" : ""}`}
          onClick={() => setFilter("nonveg")}
        >
          <span className="w-4 h-4 border-2 border-red-600 bg-red-500 rounded-sm flex items-center justify-center">
            <span className="w-2 h-2 bg-white rounded-full"></span>
          </span>
          Non-Veg
        </Button>
      </div>

      {/* Layout */}
      <div className="flex flex-row w-full max-w-7xl mx-auto px-4 py-6 gap-6">
        {/* Sidebar */}
        <aside className="w-24 sm:w-40 md:w-60 sticky top-28 h-[calc(100vh-8rem)] overflow-y-auto bg-linear-to-r from-yellow-500 via-yellow-50 to-yellow-500 border-r rounded-xl shadow-sm p-1">
          {loadingCategories
            ? Array(6).fill(0).map((_, i) => <SkeletonCategory key={i} />)
            : categories.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex flex-col items-center cursor-pointer rounded-xl px-10 py-2 mb-2 transition-all border ${
                    activeCategory === cat.id
                      ? "bg-orange-100 border-orange-400 shadow-lg"
                      : "hover:bg-gray-50 border-transparent"
                  }`}
                >
                  <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 shadow-sm">
                    <img
                      src={cat.imageUrl || "/placeholder.svg"}
                      alt={cat.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg";
                      }}
                    />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-center mt-1 uppercase">
                    {cat.name}
                  </span>
                </div>
              ))}
        </aside>

        {/* Products Grid */}
        <main className="flex-1">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6 flex items-center gap-3">
            {currentCategoryName}
            <span className="text-sm font-normal text-gray-500">
              ({currentProducts.length} items)
            </span>
          </h2>

          {loadingProducts ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array(8).fill(0).map((_, i) => (
                <Card key={i} className="overflow-hidden rounded-2xl bg-white shadow-md">
                  <SkeletonCard />
                </Card>
              ))}
            </div>
          ) : currentProducts.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-gray-400 text-6xl mb-4">Empty Plate</div>
              <p className="text-xl font-medium text-gray-600">No food available in this category</p>
              <p className="text-gray-500 mt-2">Try selecting another category or come back later!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {currentProducts.map((product) => {
                const firstImage =
                  product.imageUrls?.[0] || product.imageUrl || "/placeholder.svg";
                return (
                  <Card
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setTempPortion(product.halfPrice ? "full" : "full");
                      setTempQuantity(1);
                    }}
                    className="overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all cursor-pointer flex flex-col border relative"
                  >
                    <div className="absolute top-2 left-2 z-10">
                      <div
                        className={`w-5 h-5 border-2 rounded-sm flex items-center justify-center ${
                          product.isVeg
                            ? "border-green-600 bg-green-500"
                            : "border-red-600 bg-red-500"
                        }`}
                      >
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    </div>

                    <div className="relative w-full h-56 bg-gray-100">
                      <img
                        src={firstImage}
                        alt={product.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = "/placeholder.svg";
                        }}
                      />
                    </div>

                    <div className="py-2 px-4 flex flex-col grow">
                      <h3 className="font-semibold text-lg text-gray-800 line-clamp-2">
                        {product.name}
                      </h3>
                      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                        <span className="text-xl font-bold text-green-600">
                          ₹{product.price}
                        </span>
                        {product.halfPrice && (
                          <span className="text-md text-gray-500">
                            | Half: ₹{product.halfPrice}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Product Dialog, Cart, Success — fully functional & identical to previous version */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        {selectedProduct && (
          <DialogContent className="max-w-full w-full h-full md:max-w-2xl md:h-auto md:max-h-[60vh] rounded-none md:rounded-2xl p-0 overflow-hidden flex flex-col">
            <DialogHeader className="p-4 md:p-4 pb-0.5 shrink-0">
              <DialogTitle className="text-lg md:text-xl pr-10 flex items-center gap-2">
                {selectedProduct.name}
                <div
                  className={`w-5 h-5 border-2 rounded-sm flex items-center justify-center ml-2 ${
                    selectedProduct.isVeg
                      ? "border-green-600 bg-green-500"
                      : "border-red-600 bg-red-500"
                  }`}
                >
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-2 pb-4">
              <div className="flex flex-col md:flex-row gap-2 md:gap-4 pt-0 ">
                <div className="relative w-full md:w-1/2 h-64 md:h-80 bg-gray-100 rounded-lg overflow-hidden shrink-0">
                  {(() => {
                    const images = getImageArray(selectedProduct);
                    const currentImg = images[currentImageIndex] || "/placeholder.svg";
                    return (
                      <>
                        <img
                          src={currentImg}
                          alt={`${selectedProduct.name} - ${currentImageIndex + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.svg";
                          }}
                        />
                        {images.length > 1 && (
                          <>
                            <button
                              onClick={() => navigateImage("prev")}
                              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all"
                            >
                              <ChevronLeft size={20} />
                            </button>
                            <button
                              onClick={() => navigateImage("next")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all"
                            >
                              <ChevronRight size={20} />
                            </button>
                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                              {currentImageIndex + 1} / {images.length}
                            </div>
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="flex-1 flex flex-col justify-between mt-4 md:mt-0 px-3">
                  <div className="space-y-3">
                    {selectedProduct.description && (
                      <div>
                        <DescriptionWithReadMore text={selectedProduct.description} />
                      </div>
                    )}

                    {selectedProduct.halfPrice && (
                      <div className="my-1">
                        <p className="text-sm font-medium text-gray-700 mb-1">Plate Type :</p>
                        <div className="flex gap-2">
                          <Button
                            variant={tempPortion === "full" ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setTempPortion("full")}
                          >
                            Full Plate
                          </Button>
                          <Button
                            variant={tempPortion === "half" ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setTempPortion("half")}
                          >
                            Half Plate
                          </Button>
                        </div>
                      </div>
                    )}

                    {selectedProduct.quantity && selectedProduct.quantity !== "1" && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-600">
                          <strong>Serves :</strong> {selectedProduct.quantity}
                        </p>
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-6">
                      <div className="ml-1">
                      <p className="text-3xl font-bold text-green-600">
                        ₹
                        {tempPortion === "half"
                          ? (selectedProduct.halfPrice || selectedProduct.price / 2) * tempQuantity
                          : selectedProduct.price * tempQuantity}
                      </p>
                    </div>
                      <p className="text-xs font-medium text-gray-700">Order Quantity:</p>
                      <div className="flex items-center border rounded-lg">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setTempQuantity(Math.max(1, tempQuantity - 1))}
                        >
                          <Minus size={14} />
                        </Button>
                        <span className="w-12 text-center font-medium">{tempQuantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setTempQuantity(tempQuantity + 1)}
                        >
                          <Plus size={14} />
                        </Button>
                      </div>
                    </div>
                    

                    <div className="flex flex-col sm:flex-row gap-3 mt-5 pt-2 pb-2 md:pb-0">
                      <Button
                        className="flex-1 bg-yellow-500 hover:bg-yellow-700 text-white text-sm md:text-base"
                        onClick={handleAddToCart}
                      >
                        Add to Cart
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Floating Cart */}
      <div
        onClick={() => setCartOpen(true)}
        className="fixed bottom-6 right-6 bg-yellow-600 hover:bg-yellow-700 text-white p-4 rounded-full shadow-lg cursor-pointer transition-all z-40"
      >
        <ShoppingCart size={26} />
        {cart.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-white text-red-600 text-xs font-bold px-2 py-1 rounded-full animate-pulse">
            {cart.reduce((sum, i) => sum + i.quantity, 0)}
          </span>
        )}
      </div>

      {/* Cart & Success Dialogs - unchanged */}
      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>
              Your Cart ({cart.reduce((s, i) => s + i.quantity, 0)} items)
            </DialogTitle>
          </DialogHeader>
          {cart.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Your cart is empty.</p>
          ) : (
            <div className="flex flex-col gap-4 mt-3 max-h-96 overflow-y-auto">
              {cart.map((item) => {
                const firstImage = item.imageUrls?.[0] || item.imageUrl || "/placeholder.svg";
                return (
                  <div key={`${item.id}-${item.portion}`} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-14 h-14 rounded-md overflow-hidden bg-gray-100 relative">
                        <img
                          src={firstImage}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.svg";
                          }}
                        />
                        <div className={`absolute top-1 left-1 w-4 h-4 border rounded-sm flex items-center justify-center ${
                          item.isVeg ? "border-green-600 bg-green-500" : "border-red-600 bg-red-500"
                        }`}>
                          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm line-clamp-1">
                          {item.name} ({item.portion === "half" ? "Half" : "Full"})
                          {item.serves && item.serves !== "1" && (
                            <span className="text-xs text-gray-500 ml-1">[Serves: {item.serves}]</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">₹{item.price} × {item.quantity}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => decreaseQty(item.id, item.portion)}>
                        <Minus size={12} />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => increaseQty(item.id, item.portion)}>
                        <Plus size={12} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => removeFromCart(item.id, item.portion)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}

              <div className="flex justify-between font-bold text-lg text-gray-800 mt-4 pt-3 border-t">
                <span>Total:</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>

              <Button className="mt-3 bg-green-600 hover:bg-green-700 text-white" onClick={handleProceedToBuy}>
                Place Order via WhatsApp
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-sm text-center rounded-2xl p-8">
          <CheckCircle className="text-green-500 w-16 h-16 mx-auto mb-3" />
          <DialogTitle className="text-xl font-bold text-gray-800 mb-2">Order Placed!</DialogTitle>
          <p className="text-gray-600">
            Your order <span className="font-semibold text-red-600">#{orderId}</span> has been sent via WhatsApp.
          </p>
          <Button className="mt-5 bg-red-600 hover:bg-red-700 text-white" onClick={() => setSuccessOpen(false)}>
            Done
          </Button>
        </DialogContent>
      </Dialog> */}

      <div className="flex space-x-1 border-t border-gray-300 py-3 justify-center text-center text-sm text-gray-500">
        Developed by <a href="https://shibim.com/" target="_blank" className="mx-1 font-bold text-yellow-700">SHIBIM</a>
      </div>
    </section>
  );
};

export default FastFoodCatalogue;