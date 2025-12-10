"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Search } from "lucide-react";
import {
  Pencil,
  Eye,
  Trash,
  Plus,
  Upload,
  X,
  LogOut,
  Settings,
  Bike,
} from "lucide-react";

/* ==================== Types ==================== */
interface Category {
  id: string;
  name?: string;
  imageUrl?: string;
  createdAt?: Timestamp;
}
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

/* ==================== Skeleton Row ==================== */
const ProductSkeletonRow = () => (
  <tr className="border-b animate-pulse">
    <td className="px-3 py-4">
      <div className="h-4 bg-gray-200 rounded w-32"></div>
    </td>
    <td className="px-3 py-4">
      <div className="h-4 bg-gray-200 rounded w-16"></div>
    </td>
    <td className="px-3 py-4">
      <div className="h-4 bg-gray-200 rounded w-16"></div>
    </td>
    <td className="px-3 py-4">
      <div className="w-6 h-6 bg-gray-200 rounded mx-auto"></div>
    </td>
    <td className="px-3 py-4">
      <div className="h-4 bg-gray-200 rounded w-12"></div>
    </td>
    <td className="px-3 py-4">
      <div className="w-12 h-12 bg-gray-200 rounded mx-auto"></div>
    </td>
    <td className="px-3 py-4">
      <div className="flex gap-2 justify-end">
        <div className="w-8 h-8 bg-gray-200 rounded"></div>
        <div className="w-8 h-8 bg-gray-200 rounded"></div>
        <div className="w-8 h-8 bg-gray-200 rounded"></div>
      </div>
    </td>
  </tr>
);

/* ==================== Helpers ==================== */
const formatName = (raw: string) =>
  raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");

/* ==================== Image Compression ==================== */
const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => (img.src = e.target?.result as string);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      let width = img.width,
        height = img.height;
      const MAX_DIM = 1200;
      if (width > height && width > MAX_DIM) {
        height = Math.round((height * MAX_DIM) / width);
        width = MAX_DIM;
      } else if (height > MAX_DIM) {
        width = Math.round((width * MAX_DIM) / height);
        height = MAX_DIM;
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      let quality = 0.9;
      const TARGET_KB = 500 * 1024;
      const tryCompress = () => {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const byteLength = Math.round((dataUrl.length * 3) / 4);
        if (byteLength < TARGET_KB || quality <= 0.1) {
          resolve(dataUrl);
        } else {
          quality = Math.max(quality - 0.1, 0.1);
          setTimeout(tryCompress, 0);
        }
      };
      tryCompress();
    };
    img.onerror = reject;
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/* ==================== Drag & Drop Upload ==================== */
const DragDropUpload: React.FC<{
  previews: string[];
  onImagesChange: (newImages: string[]) => void;
  onRemove: (index: number) => void;
  id: string;
}> = ({ previews, onImagesChange, onRemove, id }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);

  const processFiles = async (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    const compressedPromises = fileArray.map(compressImage);
    const results = await Promise.all(compressedPromises);
    const valid = results.filter((r): r is string => r !== null);
    onImagesChange(valid);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          isDragging ? "border-red-500 bg-red-50" : "border-gray-300 hover:border-red-500"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="h-10 w-10 text-gray-400" />
        <p className="text-sm font-medium text-gray-700 mt-2">
          {previews.length > 0 ? "Add more images" : "Click or drag to upload"}
        </p>
        <p className="text-xs text-gray-500 mt-1">Auto-compressed less than 500 KB each</p>
      </div>
      <input
        ref={fileInputRef}
        id={id}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFileChange}
      />
    </div>
  );
};

/* ==================== Delivery Charge Settings ==================== */
const DeliveryChargeSettings: React.FC = () => {
  const [deliveryCharge, setDeliveryCharge] = useState<number>(50);
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState<string>("");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "deliveryCharge"), (snap) => {
      if (snap.exists() && typeof snap.data()?.amount === "number") {
        setDeliveryCharge(snap.data()!.amount);
      }
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    const value = parseInt(tempValue);
    if (isNaN(value) || value < 0) {
      alert("Please enter a valid amount (greater than or equal to 0)");
      return;
    }
    try {
      await setDoc(doc(db, "settings", "deliveryCharge"), { amount: value }, { merge: true });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update delivery charge");
    }
  };

  return (
    <Card className="mb-8 p-6 bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-200 shadow-lg">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Bike className="h-12 w-12 text-emerald-600" />
          <div>
            <h3 className="text-2xl font-bold text-gray-800">Delivery Charge</h3>
            <p className="text-sm text-gray-600">This amount is added to every online (delivery) order</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {isEditing ? (
            <>
              <Input
                type="number"
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                className="w-32 text-xl font-bold text-emerald-700"
                autoFocus
                placeholder="50"
              />
              <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
                Save
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <span className="text-5xl font-extrabold text-emerald-700">₹{deliveryCharge}</span>
              <Button
                variant="outline"
                className="border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                onClick={() => {
                  setTempValue(deliveryCharge.toString());
                  setIsEditing(true);
                }}
              >
                <Pencil className="h-5 w-5 mr-2" />
                Change
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
};

/* ==================== Main Admin Panel ==================== */
const AdminPanel: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [productsByCat, setProductsByCat] = useState<Record<string, Product[]>>({});
  const [loadingProductsByCat, setLoadingProductsByCat] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Flatten all products for search
  const allProducts = useMemo(() => {
    const list: (Product & { categoryId: string; categoryName?: string })[] = [];
    categories.forEach((cat) => {
      const prods = productsByCat[cat.id] || [];
      prods.forEach((p) => {
        list.push({ ...p, categoryId: cat.id, categoryName: cat.name });
      });
    });
    return list;
  }, [categories, productsByCat]);

  // Filtered products based on search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
    );
  }, [allProducts, searchQuery]);

  // Only cleanup junk categories (no default seeding)
  useEffect(() => {
    const cleanupJunk = async () => {
      const junkNames = ["Foods"];
      for (const bad of junkNames) {
        const q = query(collection(db, "categories"), where("name", "==", bad));
        const snap = await getDocs(q);
        for (const d of snap.docs) await deleteDoc(d.ref);
      }
    };
    cleanupJunk();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "categories"), (snap) => {
      const fetched: Category[] = [];
      snap.docs.forEach((d) => {
        const data = d.data();
        const name = data.name ? formatName(data.name) : undefined;
        fetched.push({
          id: d.id,
          name,
          imageUrl: data.imageUrl ?? undefined,
          createdAt: data.createdAt ?? undefined,
        });
      });
      const sorted = fetched.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });
      setCategories(sorted);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    categories.forEach((cat) => {
      setLoadingProductsByCat(prev => ({ ...prev, [cat.id]: true }));

      const unsub = onSnapshot(collection(db, "categories", cat.id, "products"), (snap) => {
        const prods: Product[] = snap.docs.map((d) => {
          const data = d.data();
          const imageUrls = data.imageUrls || (data.imageUrl ? [data.imageUrl] : []);
          return {
            id: d.id,
            name: data.name ?? "Unnamed",
            price: data.price ?? 0,
            halfPrice: data.halfPrice ?? undefined,
            quantity: data.quantity ?? "1",
            description: data.description ?? undefined,
            imageUrl: data.imageUrl ?? undefined,
            imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
            createdAt: data.createdAt ?? undefined,
            isVeg: data.isVeg ?? true,
          };
        });
        const sorted = prods.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        });
        setProductsByCat((prev) => ({ ...prev, [cat.id]: sorted }));
        setLoadingProductsByCat(prev => ({ ...prev, [cat.id]: false }));
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach((u) => u());
  }, [categories]);

  const handleLogout = () => {
    sessionStorage.removeItem("adminAuth");
    window.location.href = "/admin/login";
  };

  return (
    <section className="min-h-screen bg-linear-to-b from-yellow-700 to-yellow-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-yellow-50">Admin - Raj Restro</h1>
          <Button variant="ghost" size="sm" className="text-yellow-50 hover:text-yellow-900" onClick={handleLogout}>
            <LogOut className="mr-2 h-5 w-5" /> Logout
          </Button>
        </div>

        <DeliveryChargeSettings />

        <div className="mb-8">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="text"
              placeholder="Search product by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-4 text-md bg-white/90 backdrop-blur-sm border-yellow-300 focus:border-yellow-500 shadow-lg"
            />
          </div>
        </div>

        {/* Search Results with Full Edit/Delete */}
        {searchQuery.trim() ? (
          <div className="mb-8">
            <Card className="bg-white/95 backdrop-blur-sm shadow-xl">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                  Search Results {filteredProducts.length > 0 && `(${filteredProducts.length})`}
                </h2>
                {filteredProducts.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No products found matching "{searchQuery}"</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[650px] text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          {["Name", "Price", "Half", "Veg", "Qty", "Image", "Actions"].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-gray-700">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((p) => (
                          <ProductRow
                            key={p.id}
                            categoryId={p.categoryId}
                            product={p}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
              <h2 className="text-2xl font-semibold text-yellow-50">Menu Categories</h2>
              <AddCategoryDialog />
            </div>

            <Accordion type="single" collapsible className="space-y-4">
              {categories.map((cat) => (
                <AccordionItem key={cat.id} value={cat.id} className="border rounded-xl shadow-sm bg-white overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:bg-orange-50 transition-colors">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        {cat.imageUrl && (
                          <img src={cat.imageUrl} alt={cat.name} className="w-10 h-10 rounded-lg object-cover" />
                        )}
                        <span className="text-lg font-medium text-gray-800">{cat.name || "Uncategorized"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <EditCategoryDialog category={cat} />
                        <DeleteDialog
                          title="Delete Category"
                          description="All products will be deleted permanently."
                          onConfirm={() => deleteDoc(doc(db, "categories", cat.id))}
                        >
                          <Button variant="destructive" size="icon" className="h-8 w-8">
                            <Trash size={16} />
                          </Button>
                        </DeleteDialog>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-4 mt-2">
                      <h3 className="text-lg font-semibold text-gray-700">Menu Items</h3>
                      <AddProductDialog categoryId={cat.id} />
                    </div>
                    <Card className="overflow-x-auto">
                      <table className="w-full min-w-[650px] text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            {["Name", "Price", "Half", "Veg", "Qty", "Image", "Actions"].map((h) => (
                              <th key={h} className="px-3 py-2 text-left font-medium text-gray-700">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {loadingProductsByCat[cat.id] ? (
                            Array(6).fill(0).map((_, i) => <ProductSkeletonRow key={i} />)
                          ) : (productsByCat[cat.id] || []).length > 0 ? (
                            (productsByCat[cat.id] || []).map((p) => (
                              <ProductRow key={p.id} categoryId={cat.id} product={p} />
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} className="text-center py-6 text-gray-500">
                                No items yet. Add one!
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </Card>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {categories.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-lg text-yellow-50">No categories yet. Create your first one!</p>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

/* ==================== All Dialogs (Exactly as before) ==================== */

const AddCategoryDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [preview, setPreview] = useState("");
  const [sizeInfo, setSizeInfo] = useState("");

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file).then((compressed) => {
      setImage(compressed);
      setPreview(compressed);
      const kb = (compressed.length * 0.75 / 1024).toFixed(1);
      setSizeInfo(`~${kb} KB`);
    }).catch(() => alert("Failed to compress image."));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Category name is required.");
      return;
    }
    if (!image) {
      alert("Category image is required.");
      return;
    }
    try {
      await addDoc(collection(db, "categories"), {
        name: formatName(name),
        imageUrl: image,
        createdAt: serverTimestamp(),
      });
      setOpen(false);
      setName("");
      setImage(null);
      setPreview("");
      setSizeInfo("");
    } catch (e) {
      console.error(e);
      alert("Failed to add category.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-yellow-500 hover:bg-yellow-700">
          <Plus size={16} className="mr-2" /> Add Category
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Menu Category</DialogTitle>
          <DialogDescription>
            Create a new category like "Pizzas", "Burgers", etc.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="cat-name">Name *</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Burgers"
            />
          </div>
          <div>
            <Label htmlFor="cat-image">Category Image * (required)</Label>
            <Input id="cat-image" type="file" accept="image/*" onChange={handleImage} />
            {preview && (
              <div className="mt-3">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-40 object-cover rounded-lg border-2 border-green-500"
                />
                <p className="text-xs text-gray-500 text-center mt-1">{sizeInfo}</p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit}>Add Category</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface EditCategoryDialogProps {
  category: Category;
}
const EditCategoryDialog: React.FC<EditCategoryDialogProps> = ({ category }) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(category.name || "");
  const [image, setImage] = useState<string | null>(category.imageUrl || null);
  const [preview, setPreview] = useState(category.imageUrl || "");
  const [sizeInfo, setSizeInfo] = useState("");

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    compressImage(file).then((compressed) => {
      setImage(compressed);
      setPreview(compressed);
      const kb = (compressed.length * 0.75 / 1024).toFixed(1);
      setSizeInfo(`~${kb} KB`);
    }).catch(() => alert("Failed to compress image."));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert("Category name is required.");
      return;
    }
    if (!image) {
      alert("Category image is required.");
      return;
    }
    try {
      await updateDoc(doc(db, "categories", category.id), {
        name: formatName(name),
        imageUrl: image,
      });
      setOpen(false);
    } catch (e) {
      console.error(e);
      alert("Failed to update.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8">
          <Pencil size={16} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
            />
          </div>
          <div>
            <Label>Category Image * (required)</Label>
            {preview && (
              <div className="mt-2 mb-3">
                <img
                  src={preview}
                  alt="Current preview"
                  className="w-full h-40 object-cover rounded-lg border"
                />
                <p className="text-xs text-gray-500 text-center mt-1">{sizeInfo || "Current image"}</p>
              </div>
            )}
            <Input type="file" accept="image/*" onChange={handleImage} />
            <p className="text-xs text-gray-500 mt-1">Upload new image to replace current one</p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface AddProductDialogProps {
  categoryId: string;
}
const AddProductDialog: React.FC<AddProductDialogProps> = ({ categoryId }) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | undefined>();
  const [halfPrice, setHalfPrice] = useState<number | undefined>();
  const [quantity, setQuantity] = useState("1");
  const [description, setDescription] = useState("");
  const [isVeg, setIsVeg] = useState(true);
  const [images, setImages] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const resetForm = () => {
    setName("");
    setPrice(undefined);
    setHalfPrice(undefined);
    setQuantity("1");
    setDescription("");
    setIsVeg(true);
    setImages([]);
    setPreviews([]);
  };

  const handleSubmit = async () => {
    if (!name.trim() || !price || price <= 0) {
      alert("Name and full price required.");
      return;
    }
    setIsLoading(true);
    try {
      await addDoc(collection(db, "categories", categoryId, "products"), {
        name: name.trim(),
        price,
        halfPrice: halfPrice || null,
        quantity: quantity || "1",
        description: description || null,
        imageUrls: images.length > 0 ? images : null,
        imageUrl: images[0] || "",
        isVeg,
        createdAt: serverTimestamp(),
      });
      setOpen(false);
      resetForm();
    } catch (e) {
      console.error(e);
      alert("Failed to add item.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-yellow-500 hover:bg-yellow-700 mt-4">
          <Plus size={14} className="mr-1" /> Add Item
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Menu Item</DialogTitle>
          <DialogDescription>
            Fill in item details. Half price is optional.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={isLoading} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Full Price *</Label>
              <Input
                type="number"
                value={price ?? ""}
                onChange={(e) => setPrice(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Enter Price of Full"
                disabled={isLoading}
              />
            </div>
            <div>
              <Label>Half Price</Label>
              <Input
                type="number"
                value={halfPrice ?? ""}
                onChange={(e) => setHalfPrice(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Enter Price of Half"
                disabled={isLoading}
              />
            </div>
          </div>
          <div>
            <Label>Serve for :</Label>
            <Input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter Serving Quantity"
              disabled={isLoading}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={isVeg}
              onCheckedChange={setIsVeg}
              id="veg-toggle"
              disabled={isLoading}
            />
            <Label htmlFor="veg-toggle" className="cursor-pointer">
              {isVeg ? (
                <span className="text-green-600 font-medium">Veg</span>
              ) : (
                <span className="text-red-600 font-medium">Non-Veg</span>
              )}
            </Label>
          </div>
          <div>
            <Label>Description (Optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              disabled={isLoading}
            />
          </div>

          <div>
            <Label>Images (auto-compressed less than 500 KB each)</Label>
            {previews.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                {previews.map((src, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={src}
                      alt={`Preview ${i + 1}`}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setImages((prev) => prev.filter((_, idx) => idx !== i));
                        setPreviews((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                    <p className="text-xs text-center mt-1 text-gray-500">
                      ~{(src.length * 0.75 / 1024).toFixed(0)} KB
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4">
              <DragDropUpload
                previews={previews}
                onImagesChange={(newImages) => {
                  setImages((prev) => [...prev, ...newImages]);
                  setPreviews((prev) => [...prev, ...newImages]);
                }}
                onRemove={(i) => {
                  setImages((prev) => prev.filter((_, idx) => idx !== i));
                  setPreviews((prev) => prev.filter((_, idx) => idx !== i));
                }}
                id="add-product-images"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Adding...
              </>
            ) : (
              "Add Item"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface EditProductDialogProps {
  categoryId: string;
  product: Product;
  onClose: () => void;
}
const EditProductDialog: React.FC<EditProductDialogProps> = ({
  categoryId,
  product,
  onClose,
}) => {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(product.price);
  const [halfPrice, setHalfPrice] = useState(product.halfPrice);
  const [quantity, setQuantity] = useState(product.quantity || "1");
  const [description, setDescription] = useState(product.description || "");
  const [isVeg, setIsVeg] = useState(product.isVeg);
  const [images, setImages] = useState<string[]>(
    product.imageUrls || (product.imageUrl ? [product.imageUrl] : [])
  );
  const [previews, setPreviews] = useState<string[]>(
    product.imageUrls || (product.imageUrl ? [product.imageUrl] : [])
  );

  const handleSave = async () => {
    if (!name.trim() || price <= 0) {
      alert("Name and price required.");
      return;
    }
    try {
      await updateDoc(doc(db, "categories", categoryId, "products", product.id), {
        name: name.trim(),
        price,
        halfPrice: halfPrice || null,
        quantity: quantity || "1",
        description: description || null,
        imageUrls: images.length > 0 ? images : null,
        imageUrl: images[0] || "",
        isVeg,
      });
      onClose();
    } catch (e) {
      console.error(e);
      alert("Failed to update item.");
    }
  };

  return (
    <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit Menu Item</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Full Price</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
          <div>
            <Label>Half Price</Label>
            <Input
              type="number"
              value={halfPrice ?? ""}
              onChange={(e) => setHalfPrice(e.target.value ? Number(e.target.value) : undefined)}
            />
          </div>
        </div>
        <div>
          <Label>Serve for :</Label>
          <Input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Enter Serving Quantity"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            checked={isVeg}
            onCheckedChange={setIsVeg}
            id="edit-veg-toggle"
          />
          <Label htmlFor="edit-veg-toggle" className="cursor-pointer">
            {isVeg ? "Veg" : "Non-Veg"}
          </Label>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>

        <div>
          <Label>Images</Label>
          {previews.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {previews.map((src, i) => (
                <div key={i} className="relative group">
                  <img
                    src={src}
                    alt={`Preview ${i + 1}`}
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setImages((prev) => prev.filter((_, idx) => idx !== i));
                      setPreviews((prev) => prev.filter((_, idx) => idx !== i));
                    }}
                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={14} />
                  </button>
                  <p className="text-xs text-center mt-1 text-gray-500">
                    ~{(src.length * 0.75 / 1024).toFixed(0)} KB
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4">
            <DragDropUpload
              previews={previews}
              onImagesChange={(newImages) => {
                setImages((prev) => [...prev, ...newImages]);
                setPreviews((prev) => [...prev, ...newImages]);
              }}
              onRemove={(i) => {
                setImages((prev) => prev.filter((_, idx) => idx !== i));
                setPreviews((prev) => prev.filter((_, idx) => idx !== i));
              }}
              id="edit-product-images"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={handleSave}>Save Changes</Button>
      </DialogFooter>
    </DialogContent>
  );
};

interface ProductRowProps {
  categoryId: string;
  product: Product;
}
const ProductRow: React.FC<ProductRowProps> = ({ categoryId, product }) => {
  const [editOpen, setEditOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const imageCount = (product.imageUrls?.length || 0) + (product.imageUrl ? 1 : 0);
  const displayImage = product.imageUrls?.[0] || product.imageUrl;

  return (
    <tr className="border-b hover:bg-gray-50 transition-colors">
      <td className="px-3 py-3 text-sm font-medium">{product.name}</td>
      <td className="px-3 py-3 text-sm">₹{product.price}</td>
      <td className="px-3 py-3 text-sm">
        {product.halfPrice ? `₹${product.halfPrice}` : "-"}
      </td>
      <td className="px-3 py-3">
        <div
          className={`w-6 h-6 border-2 rounded-sm flex items-center justify-center ${
            product.isVeg
              ? "border-green-600 bg-green-500"
              : "border-red-600 bg-red-500"
          }`}
        >
          <div className="w-3 h-3 bg-white rounded-full"></div>
        </div>
      </td>
      <td className="px-3 py-3 text-sm">{product.quantity || "1"}</td>
      <td className="px-3 py-3">
        {displayImage ? (
          <div className="relative">
            <img
              src={displayImage}
              alt={product.name}
              className="w-12 h-12 object-cover rounded"
            />
            {imageCount > 1 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {imageCount}
              </span>
            )}
          </div>
        ) : (
          <div className="w-12 h-12 bg-gray-200 border rounded flex items-center justify-center">
            <Upload size={16} className="text-gray-400" />
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <Pencil size={14} />
              </Button>
            </DialogTrigger>
            <EditProductDialog
              categoryId={categoryId}
              product={product}
              onClose={() => setEditOpen(false)}
            />
          </Dialog>
          <Dialog open={viewOpen} onOpenChange={setViewOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <Eye size={14} />
              </Button>
            </DialogTrigger>
            <ViewProductDialog product={product} onClose={() => setViewOpen(false)} />
          </Dialog>
          <DeleteDialog
            title="Delete Item"
            description="This action cannot be undone."
            onConfirm={() =>
              deleteDoc(doc(db, "categories", categoryId, "products", product.id))
            }
          >
            <Button size="icon" variant="destructive" className="h-8 w-8">
              <Trash size={14} />
            </Button>
          </DeleteDialog>
        </div>
      </td>
    </tr>
  );
};

interface ViewProductDialogProps {
  product: Product;
  onClose: () => void;
}
const ViewProductDialog: React.FC<ViewProductDialogProps> = ({ product, onClose }) => {
  const displayImage = product.imageUrls?.[0] || product.imageUrl;
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{product.name}</DialogTitle>
        <DialogDescription>
          {product.isVeg ? (
            <span className="text-green-600 font-medium">Veg</span>
          ) : (
            <span className="text-red-600 font-medium">Non-Veg</span>
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-4">
        {displayImage && (
          <img
            src={displayImage}
            alt={product.name}
            className="w-full h-56 object-cover rounded-lg"
          />
        )}
        <div className="space-y-2 text-sm">
          <p><strong>Full Price:</strong> ₹{product.price}</p>
          {product.halfPrice && <p><strong>Half Price:</strong> ₹{product.halfPrice}</p>}
          {product.quantity && <p><strong>Quantity:</strong> {product.quantity}</p>}
          {product.description && <p><strong>Description:</strong> {product.description}</p>}
          {product.createdAt && (
            <p><strong>Added:</strong> {new Date(product.createdAt.toMillis()).toLocaleDateString()}</p>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onClose}>Close</Button>
      </DialogFooter>
    </DialogContent>
  );
};

interface DeleteDialogProps {
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  children: React.ReactNode;
}
const DeleteDialog: React.FC<DeleteDialogProps> = ({
  title,
  description,
  onConfirm,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const handle = async () => {
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      alert("Failed to delete.");
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handle}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminPanel;