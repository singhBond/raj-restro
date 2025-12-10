"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  onSnapshot,
  Timestamp,
  doc,
  increment,
  setDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Trash2,
  ChevronLeft,
  ChevronRight,
  Bike,
  Store,
  Eye,
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

// === Skeleton Loaders ===
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
  const [loadingProductsByCat, setLoadingProductsByCat] = useState<Record<string, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState<boolean>(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [filter, setFilter] = useState<"all" | "veg" | "nonveg">("all");

  // Delivery & Order State
  const [orderMode, setOrderMode] = useState<"offline" | "online">("offline");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCharge, setDeliveryCharge] = useState<number>(50);

  // Loading States
  const [loadingCategories, setLoadingCategories] = useState(true);

  // === NEW: Total Page Views State ===
  const [totalViews, setTotalViews] = useState<number>(0);

  // === REAL-TIME PAGE VIEWS COUNTER (Firebase) ===
  useEffect(() => {
    const hasViewed = sessionStorage.getItem("hasViewedMenu");
    if (!hasViewed) {
      const viewsRef = doc(db, "settings", "pageViews");
      setDoc(viewsRef, { count: increment(1) }, { merge: true }).catch(console.error);
      sessionStorage.setItem("hasViewedMenu", "true");
    }

    const unsub = onSnapshot(doc(db, "settings", "pageViews"), (snap) => {
      if (snap.exists() && typeof snap.data()?.count === "number") {
        setTotalViews(snap.data().count);
      }
    });

    return () => unsub();
  }, []);

  // === DYNAMIC DELIVERY CHARGE FROM FIRESTORE ===
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "settings", "deliveryCharge"),
      (snap) => {
        if (snap.exists() && typeof snap.data()?.amount === "number") {
          setDeliveryCharge(snap.data()!.amount);
        } else {
          setDeliveryCharge(50);
        }
      },
      (error) => {
        console.error("Error fetching delivery charge:", error);
        setDeliveryCharge(50);
      }
    );
    return () => unsub();
  }, []);

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

  // === Load Products with per-category loading ===
  useEffect(() => {
    if (categories.length === 0) return;

    const unsubs: (() => void)[] = [];

    categories.forEach((cat) => {
      // Mark this category as loading
      setLoadingProductsByCat(prev => ({ ...prev, [cat.id]: true }));

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
          setLoadingProductsByCat(prev => ({ ...prev, [cat.id]: false }));
        },
        (error) => {
          console.error(`Error fetching products for ${cat.name}:`, error);
          setLoadingProductsByCat(prev => ({ ...prev, [cat.id]: false }));
        }
      );
      unsubs.push(unsub);
    });

    return () => unsubs.forEach((unsub) => unsub());
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

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const totalAmount = orderMode === "online" ? subtotal + deliveryCharge : subtotal;

  const handleProceedToBuy = () => {
    if (cart.length === 0) return;

    if (orderMode === "online") {
      if (!customerName || !customerPhone || !deliveryAddress) {
        alert("Please fill all delivery details.");
        return;
      }
      if (!/^\d{10}$/.test(customerPhone.replace(/\D/g, ""))) {
        alert("Please enter a valid 10-digit phone number.");
        return;
      }
    }

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

    const newOrderId = `FF-${Math.floor(100000 + Math.random() * 900000)}`;

    let message = `*New Order*\n\n*Order ID:* ${newOrderId}\n*Mode:* ${
      orderMode === "online" ? "Delivery (Online)" : "Takeaway (Offline)"
    }\n\n${orderDetails}\n\n*Subtotal: ₹${subtotal.toFixed(2)}*`;

    if (orderMode === "online") {
      message += `\n*Delivery Charge: ₹${deliveryCharge}*\n*Total: ₹${totalAmount.toFixed(
        2
      )}*\n\n*Customer Details:*\nName: ${customerName}\nPhone: ${customerPhone}\nAddress: ${deliveryAddress}`;
    } else {
      message += `\n*Total: ₹${totalAmount.toFixed(2)}*`;
    }

    message += `\n\nPlease confirm my order.`;

    window.open(
      `https://wa.me/917369068632?text=${encodeURIComponent(message)}`,
      "_blank"
    );

    setCart([]);
    localStorage.removeItem("fastfood_cart");
    setCartOpen(false);
    setCustomerName("");
    setCustomerPhone("");
    setDeliveryAddress("");
    setOrderMode("offline");
  };

  const currentCategoryName =
    categories.find((cat) => cat.id === activeCategory)?.name || "Menu";

  const currentProducts = (productsByCat[activeCategory] || []).filter((p) => {
    if (filter === "veg") return p.isVeg;
    if (filter === "nonveg") return !p.isVeg;
    return true;
  });

  const isCurrentCategoryLoading = loadingProductsByCat[activeCategory] ?? false;

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

  // Full page loader
  if (loadingCategories) {
    return (
      <section className="min-h-screen bg-linear-to-b from-orange-50 to-white flex flex-col items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 border-8 border-yellow-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-6 text-xl font-semibold text-gray-700">Loading menu...</p>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-linear-to-b from-orange-50 to-white relative ">
      {/* Header */}
      <div className="flex flex-col items-center text-center py-4  bg-linear-to-r from-yellow-800 via-yellow-500 to-yellow-800">
        <img src="/logo.png" className="h-20 rounded-full" alt="Logo" />
        <h1 className="text-3xl md:text-6xl font-extrabold text-yellow-400  ">
          Raj Family Restaurant
        </h1>
        <h2 className="text-2xl md:text-4xl font-bold text-white mt-2">
          Fast • Tasty • Fresh
        </h2>
        <p className="text-black max-w-2xl mt-3 text-sm md:text-lg">
          Mob: 6200656377
        </p>
        <p className="text-yellow-50 max-w-2xl mt-1 text-xs md:text-md">
          ~Accepting Online Order : 10:00 AM - 9:00 PM~
        </p>
      </div>

      {/* Veg/Non-Veg Filter */}
      <div className="flex justify-center gap-3 py-4 bg-white shadow-sm sticky top-0 z-30">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          className={`flex items-center gap-2 ${
            filter === "all" ? "bg-yellow-600 hover:bg-yellow-700" : ""
          }`}
          onClick={() => setFilter("all")}
        >
          All
        </Button>
        <Button
          variant={filter === "veg" ? "default" : "outline"}
          className={`flex items-center gap-2 ${
            filter === "veg" ? "bg-green-600 hover:bg-green-700" : ""
          }`}
          onClick={() => setFilter("veg")}
        >
          <span className="w-4 h-4 border-2 border-green-600 bg-green-500 rounded-sm flex items-center justify-center">
            <span className="w-2 h-2 bg-white rounded-full"></span>
          </span>
          Veg
        </Button>
        <Button
          variant={filter === "nonveg" ? "default" : "outline"}
          className={`flex items-center gap-2 ${
            filter === "nonveg" ? "bg-red-600 hover:bg-red-700" : ""
          }`}
          onClick={() => setFilter("nonveg")}
        >
          <span className="w-4 h-4 border-2 border-red-600 bg-red-500 rounded-sm flex items-center justify-center">
            <span className="w-2 h-2 bg-white rounded-full"></span>
          </span>
          Non-Veg
        </Button>
      </div>

      {/* Layout */}
      <div className="flex flex-row w-full max-w-7xl mx-auto px-2 py-6 gap-6">
        {/* Sidebar */}
        <aside className="w-24 sm:w-40 md:w-60 sticky top-28 h-[calc(100vh-8rem)] overflow-y-auto bg-linear-to-r from-yellow-400 via-yellow-50 to-yellow-400 border-r rounded-xl shadow-sm p-1">
          {categories.map((cat) => (
            <div
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex flex-col items-center cursor-pointer rounded-xl px-10 py-2 mb-2  transition-all border ${
                activeCategory === cat.id
                  ? "bg-orange-100 border-orange-400 shadow-lg"
                  : "hover:bg-gray-50 border-transparent"
              }`}
            >
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 shadow-sm ">
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
              ({isCurrentCategoryLoading ? "Loading..." : currentProducts.length} items)
            </span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {isCurrentCategoryLoading ? (
              // Show 12 skeleton cards while loading current category
              Array(12).fill(0).map((_, i) => (
                <Card key={`skeleton-${i}`} className="overflow-hidden rounded-2xl bg-white shadow-md">
                  <SkeletonCard />
                </Card>
              ))
            ) : currentProducts.length === 0 ? (
              <div className="col-span-full text-center py-16 text-gray-500">
                <p className="text-lg">No items in this category yet.</p>
              </div>
            ) : (
              currentProducts.map((product) => {
                const firstImage =
                  product.imageUrls?.[0] ||
                  product.imageUrl ||
                  "/placeholder.svg";
                return (
                  <Card
                    key={product.id}
                    onClick={() => {
                      setSelectedProduct(product);
                      setTempPortion(product.halfPrice ? "full" : "full");
                      setTempQuantity(1);
                    }}
                    className="overflow-hidden rounded-2xl bg-white shadow-lg shadow-amber-00 hover:shadow-xl transition-all cursor-pointer flex flex-col border relative"
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
              })
            )}
          </div>
        </main>
      </div>

      {/* Product Dialog */}
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
        className="fixed bottom-6 right-6 mb-12 bg-yellow-600 hover:bg-yellow-700 text-white p-4 border-white border-2 rounded-full shadow-lg cursor-pointer transition-all z-40 "
      >
        <ShoppingCart size={26} />
        {cart.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-white text-red-600 text-xs font-bold px-2 py-1 rounded-full animate-pulse">
            {cart.reduce((sum, i) => sum + i.quantity, 0)}
          </span>
        )}
      </div>

      {/* Cart Dialog */}
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
              {/* Cart Items */}
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
                          onError={(e) => { e.currentTarget.src = "/placeholder.svg"; }}
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

              {/* Order Type */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm font-semibold mb-3">Order Type:</p>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={orderMode === "offline" ? "default" : "outline"}
                    className={orderMode === "offline" ? "bg-orange-600 hover:bg-orange-700" : ""}
                    onClick={() => setOrderMode("offline")}
                  >
                    <Store className="w-4 h-4 mr-2" />
                    Takeaway
                  </Button>
                  <Button
                    variant={orderMode === "online" ? "default" : "outline"}
                    className={orderMode === "online" ? "bg-blue-600 hover:bg-blue-700" : ""}
                    onClick={() => setOrderMode("online")}
                  >
                    <Bike className="w-4 h-4 mr-2" />
                    Delivery
                  </Button>
                </div>
              </div>

              {/* Delivery Form - Only for Online */}
              {orderMode === "online" && (
                <div className="mt-4 space-y-4 border-t pt-4">
                  <div>
                    <Label htmlFor="name">Your Name</Label>
                    <Input
                      id="name"
                      placeholder="Enter your name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      maxLength={10}
                      placeholder="10-digit mobile number"
                      value={customerPhone}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                        setCustomerPhone(value);
                      }}
                      className={customerPhone.length > 0 && customerPhone.length !== 10 ? "border-red-500" : ""}
                    />
                    {customerPhone.length > 0 && customerPhone.length !== 10 && (
                      <p className="text-xs text-red-600 mt-1">Please enter exactly 10 digits</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="address">Delivery Address</Label>
                    <Textarea
                      id="address"
                      placeholder="Full address with landmark"
                      rows={3}
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Pricing Summary */}
              <div className="mt-6 pt-4 border-t space-y-3">
                <div className="flex justify-between text-base">
                  <span className="text-gray-700">Subtotal</span>
                  <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
                </div>

                {orderMode === "online" && (
                  <div className="flex justify-between text-base">
                    <span className="text-gray-700 flex items-center gap-2">
                      Delivery Charge <Bike className="w-4 h-4 text-blue-600" />
                    </span>
                    <span className="font-semibold text-blue-600">+ ₹{deliveryCharge}</span>
                  </div>
                )}

                <div className="flex justify-between text-xl font-bold text-gray-800 pt-3 border-t">
                  <span>Total Amount</span>
                  <span className="text-green-600">₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Place Order Button */}
              <Button
                className="mt-4 bg-green-600 hover:bg-green-700 text-white text-lg py-6 w-full font-bold"
                onClick={handleProceedToBuy}
                disabled={orderMode === "online" && (customerPhone.length !== 10 || !customerName || !deliveryAddress)}
              >
                Place Order via WhatsApp
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* === TOTAL VISITS COUNTER AT BOTTOM === */}
      <div className=" bottom-0 left-0 right-0 bg-linear-to-t from-black/90 to-black/70 text-white  z-50 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-3 text-sm md:text-lg font-semibold">
          <Eye className="w-5 h-5 text-yellow-400" />
          <span>Total Visits:</span>
          <span className="text-yellow-400 text-lg md:text-2xl font-bold">
            {totalViews.toLocaleString()}
          </span>
          <span className="hidden md:inline text-gray-300">people love our menu!</span>
        </div>
      </div>

      {/* Footer */}
      <footer className=" bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 z-50">
        <div className="py-1 text-center text-xs text-gray-600 font-medium">
          Developed by{" "}
          <a
            href="https://shibim.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-yellow-700 hover:text-yellow-800 transition-colors"
          >
            SHIBIM
          </a>
        </div>
      </footer>

    </section>
  );
};

export default FastFoodCatalogue;
