"use client";

import React, { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Utensils,
  Plus,
  Trash2,
  Edit,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Eye,
  EyeOff,
  Sparkles,
  Flame,
  X,
  Image as ImageIcon
} from "lucide-react";
import {
  getAdminMenuData,
  updateMenuItemAvailability,
  upsertAdminMenuItem,
  deleteAdminMenuItem
} from "@/actions/admin";
import { authClient } from "@/lib/auth-client";

export default function AdminMenuPage() {
  // Data State
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [adminUserId, setAdminUserId] = useState<string>("");

  // Filters State
  const [activeCategoryId, setActiveCategoryId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>( "");

  // Create / Edit Dish Modal States
  const [showUpsertModal, setShowUpsertModal] = useState<boolean>(false);
  const [isSubmittingItem, setIsSubmittingItem] = useState<boolean>(false);
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<any | null>(null);

  // Form Field States
  const [itemName, setItemName] = useState<string>("");
  const [itemDescription, setItemDescription] = useState<string>("");
  const [itemPrice, setItemPrice] = useState<string>("");
  const [itemPrepTime, setItemPrepTime] = useState<string>("15");
  const [itemCategoryId, setItemCategoryId] = useState<string>("");
  const [itemIsVeg, setItemIsVeg] = useState<boolean>(true);
  const [itemIsBestseller, setItemIsBestseller] = useState<boolean>(false);
  const [itemIsSpecial, setItemIsSpecial] = useState<boolean>(false);
  const [itemImage, setItemImage] = useState<string>("");

  // Fetch Session User ID
  useEffect(() => {
    async function loadUser() {
      const { data } = await authClient.getSession();
      if (data?.user) {
        setAdminUserId(data.user.id);
      }
    }
    loadUser();
  }, []);

  const loadMenu = async () => {
    try {
      const res = await getAdminMenuData();
      if (res.success && res.categories) {
        setCategories(res.categories);
        if (res.categories.length > 0 && activeCategoryId === "ALL") {
          setActiveCategoryId(res.categories[0].id);
        }
        setError(null);
      } else {
        setError(res.error || "Failed to load menu list.");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred loading menu data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();
  }, []);

  // Set form fields when editing item
  const openUpsertModal = (item?: any) => {
    if (item) {
      setSelectedItemForEdit(item);
      setItemName(item.name);
      setItemDescription(item.description || "");
      setItemPrice(item.price.toString());
      setItemPrepTime(item.preparationTime.toString());
      setItemCategoryId(item.categoryId);
      setItemIsVeg(item.isVeg);
      setItemIsBestseller(item.isBestseller || false);
      setItemIsSpecial(item.isSpecial || false);
      setItemImage(item.image || "");
    } else {
      setSelectedItemForEdit(null);
      setItemName("");
      setItemDescription("");
      setItemPrice("");
      setItemPrepTime("15");
      setItemCategoryId(activeCategoryId !== "ALL" ? activeCategoryId : categories[0]?.id || "");
      setItemIsVeg(true);
      setItemIsBestseller(false);
      setItemIsSpecial(false);
      setItemImage("");
    }
    setShowUpsertModal(true);
  };

  // Actions
  const handleToggleAvailability = async (itemId: string, currentAvailable: boolean) => {
    if (!adminUserId) return;
    
    // Optimistic UI update
    setCategories(prev => prev.map(cat => ({
      ...cat,
      items: cat.items.map((item: any) => 
        item.id === itemId ? { ...item, isAvailable: !currentAvailable } : item
      )
    })));

    try {
      const res = await updateMenuItemAvailability(itemId, !currentAvailable, adminUserId);
      if (!res.success) {
        loadMenu();
        alert(res.error || "Failed to change availability.");
      }
    } catch (err) {
      console.error(err);
      loadMenu();
      alert("Error toggling item availability.");
    }
  };

  const handleUpsertItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !itemPrice || !itemCategoryId || !adminUserId) return;
    setIsSubmittingItem(true);

    try {
      const res = await upsertAdminMenuItem({
        id: selectedItemForEdit?.id,
        categoryId: itemCategoryId,
        name: itemName,
        description: itemDescription,
        price: parseFloat(itemPrice),
        preparationTime: parseInt(itemPrepTime),
        isVeg: itemIsVeg,
        isBestseller: itemIsBestseller,
        isSpecial: itemIsSpecial,
        image: itemImage
      }, adminUserId);

      if (res.success) {
        setShowUpsertModal(false);
        loadMenu();
      } else {
        alert(res.error || "Failed to save item.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving item.");
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const confirmDelete = confirm("Are you sure you want to delete this menu item?");
    if (!confirmDelete) return;

    if (!adminUserId) return;
    try {
      const res = await deleteAdminMenuItem(itemId, adminUserId);
      if (res.success) {
        loadMenu();
      } else {
        alert(res.error || "Failed to delete item.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting item.");
    }
  };

  // Filter items in active category matching search query
  const filteredItems = useMemo(() => {
    const activeCat = categories.find(c => c.id === activeCategoryId);
    if (!activeCat) return [];

    return activeCat.items.filter((item: any) => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [categories, activeCategoryId, searchQuery]);

  if (loading) {
    return (
      <div className="h-96 flex flex-col justify-center items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#baa47f]" />
        <span className="text-xs uppercase font-bold tracking-widest text-zinc-550">Loading menu layout...</span>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <div className="flex justify-between items-center pb-2 border-b border-[#251416]">
        <div>
          <h1 className="text-lg font-display font-extrabold text-white tracking-tight uppercase">
            Menu Catalog
          </h1>
          <p className="text-[10px] text-zinc-450 uppercase tracking-widest font-bold mt-0.5">
            Manage food item pricing, availability, and description configurations
          </p>
        </div>

        <button
          onClick={() => openUpsertModal()}
          className="px-4 py-2 bg-primary hover:bg-[#871b30] border border-[#baa47f]/20 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4" /> Add Dish
        </button>
      </div>

      {/* Categories Horizontal Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-[#201011]">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategoryId(cat.id)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition shrink-0 cursor-pointer ${
              activeCategoryId === cat.id
                ? "bg-[#251416] border border-[#baa47f]/25 text-[#baa47f]"
                : "bg-zinc-950 border border-zinc-850 text-zinc-400 hover:text-white"
            }`}
          >
            {cat.name} ({cat.items.length})
          </button>
        ))}
      </div>

      {/* Search Input */}
      <div className="relative w-full md:w-80">
        <Search className="w-4 h-4 text-zinc-650 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search items in category..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#140b0c] border border-[#251416] rounded-lg pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
        />
      </div>

      {/* Items List layout */}
      {filteredItems.length === 0 ? (
        <div className="h-44 flex flex-col justify-center items-center border border-dashed border-[#251416] rounded-xl text-center text-zinc-550 p-6">
          <Utensils className="w-10 h-10 text-zinc-750 mb-2" />
          <h3 className="text-sm font-bold text-zinc-400">No items found</h3>
          <p className="text-[10px]">No menu catalog items currently in this section.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item: any) => (
            <div
              key={item.id}
              className={`bg-[#140b0c] border rounded-xl p-4 flex gap-4 shadow-soft hover:border-[#baa47f]/20 transition relative ${
                !item.isAvailable ? "opacity-60 border-zinc-850" : "border-[#251416]"
              }`}
            >
              {/* Item image */}
              <div className="w-20 h-20 rounded-lg overflow-hidden border border-[#251416] shrink-0 bg-zinc-950 flex items-center justify-center">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-zinc-700" />
                )}
              </div>

              {/* Item details */}
              <div className="flex-1 flex flex-col justify-between gap-2 min-w-0">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`w-2.5 h-2.5 border flex items-center justify-center shrink-0 p-0.5 ${
                      item.isVeg ? "border-emerald-600" : "border-red-600"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? "bg-emerald-600" : "bg-red-600"}`} />
                    </span>
                    <h3 className="font-extrabold text-sm text-white truncate max-w-[150px]">
                      {item.name}
                    </h3>

                    {/* Badges */}
                    {item.isBestseller && (
                      <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/25 px-1.5 py-0.5 rounded font-extrabold tracking-wider">
                        BEST
                      </span>
                    )}
                    {item.isSpecial && (
                      <span className="text-[8px] bg-purple-500/10 text-purple-400 border border-purple-500/25 px-1.5 py-0.5 rounded font-extrabold tracking-wider">
                        SPECIAL
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-zinc-450 line-clamp-2 mt-1 leading-normal">
                    {item.description || "No description configured."}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-[#201011] pt-2 mt-1 gap-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-mono font-extrabold text-gold-400">
                      ₹{item.price.toFixed(0)}
                    </span>
                    <span className="text-[9px] text-zinc-550 font-bold">
                      • {item.preparationTime} min prep
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleAvailability(item.id, item.isAvailable)}
                      className={`p-1.5 rounded border transition cursor-pointer ${
                        item.isAvailable
                          ? "bg-emerald-950/20 border-emerald-500/35 text-emerald-400"
                          : "bg-zinc-950 border-zinc-800 text-zinc-500"
                      }`}
                      title={item.isAvailable ? "Set unavailable" : "Set available"}
                    >
                      {item.isAvailable ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => openUpsertModal(item)}
                      className="p-1.5 bg-[#201011] hover:bg-[#2c1719] border border-[#2d191b] rounded text-zinc-350 hover:text-white cursor-pointer"
                      title="Edit Item"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 bg-red-950/20 hover:bg-red-900/10 border border-red-500/20 text-red-400 rounded cursor-pointer"
                      title="Delete Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* DIALOG: CREATE / EDIT MENU ITEM DIALOG */}
      <AnimatePresence>
        {showUpsertModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#140b0c] border border-[#2d191b] rounded-xl p-6 w-full max-w-md shadow-modal flex flex-col gap-4 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center pb-2 border-b border-[#2d191b]">
                <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-white">
                  {selectedItemForEdit ? "Edit Menu Dish" : "Create New Menu Dish"}
                </h3>
                <button
                  onClick={() => setShowUpsertModal(false)}
                  className="w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpsertItemSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">Dish Name</label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. Paneer Tikka Masala"
                    className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">Category Section</label>
                  <select
                    value={itemCategoryId}
                    onChange={(e) => setItemCategoryId(e.target.value)}
                    className="w-full bg-[#0d0506] border border-[#2d191b] text-zinc-350 text-xs rounded-lg px-3 py-2.5 focus:outline-none"
                    required
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">Price (INR)</label>
                    <input
                      type="number"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      placeholder="e.g. 250"
                      className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">Est. Preparation Time (mins)</label>
                    <input
                      type="number"
                      value={itemPrepTime}
                      onChange={(e) => setItemPrepTime(e.target.value)}
                      placeholder="e.g. 15"
                      className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-455 font-bold uppercase tracking-wider">Description</label>
                  <textarea
                    value={itemDescription}
                    onChange={(e) => setItemDescription(e.target.value)}
                    placeholder="Describe main ingredients and spices flavor level..."
                    className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-700 focus:outline-none h-16 resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-450 font-bold uppercase tracking-wider">Image URL</label>
                  <input
                    type="text"
                    value={itemImage}
                    onChange={(e) => setItemImage(e.target.value)}
                    placeholder="https://example.com/paneer.jpg"
                    className="w-full bg-[#0d0506] border border-[#2d191b] rounded-lg px-3 py-2.5 text-xs text-white placeholder-zinc-700 focus:outline-none"
                  />
                </div>

                {/* Attribute Toggles */}
                <div className="grid grid-cols-3 gap-2 py-1">
                  <button
                    type="button"
                    onClick={() => setItemIsVeg(!itemIsVeg)}
                    className={`p-2.5 rounded border text-[10px] font-bold uppercase tracking-wider transition text-center cursor-pointer ${
                      itemIsVeg
                        ? "bg-emerald-950/20 border-emerald-500/35 text-emerald-400"
                        : "bg-[#201011] border-[#2d191b] text-zinc-500"
                    }`}
                  >
                    Veg Diet
                  </button>

                  <button
                    type="button"
                    onClick={() => setItemIsBestseller(!itemIsBestseller)}
                    className={`p-2.5 rounded border text-[10px] font-bold uppercase tracking-wider transition text-center cursor-pointer ${
                      itemIsBestseller
                        ? "bg-amber-955/20 border-amber-500/35 text-amber-500"
                        : "bg-[#201011] border-[#2d191b] text-zinc-500"
                    }`}
                  >
                    Bestseller
                  </button>

                  <button
                    type="button"
                    onClick={() => setItemIsSpecial(!itemIsSpecial)}
                    className={`p-2.5 rounded border text-[10px] font-bold uppercase tracking-wider transition text-center cursor-pointer ${
                      itemIsSpecial
                        ? "bg-purple-955/20 border-purple-500/35 text-purple-400"
                        : "bg-[#201011] border-[#2d191b] text-zinc-500"
                    }`}
                  >
                    Special
                  </button>
                </div>

                {/* Submit Controls */}
                <div className="flex gap-2.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setShowUpsertModal(false)}
                    className="flex-1 py-2.5 rounded-lg border border-[#2d191b] text-[#baa47f] hover:text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingItem}
                    className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-md flex items-center justify-center gap-1"
                  >
                    {isSubmittingItem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Save Item
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
