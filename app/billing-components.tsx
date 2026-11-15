"use client";

import { useState, useMemo } from "react";
import {
  Product,
  Bill,
  CATEGORY_LABELS,
  ProductCategory,
  buildPaytmUPIUrl,
  generateQRCode,
  computeSalesAnalytics,
  getSavedProducts,
  saveProducts,
  getSavedBills,
  saveBills,
  playPaytmChime,
  speakTamil,
  PAYTM_DEFAULT_CONFIG,
} from "@/lib/billing";
import {
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  TrendingUp,
  Printer,
  Sparkles,
  ArrowRight,
  Search,
  ShoppingCart,
  Calendar,
  IndianRupee,
  Store,
  ChevronRight,
  Flame,
  Award,
} from "lucide-react";

type CartItem = {
  product: Product;
  quantity: number;
};

// ==========================================
// BILLING SCREEN (பில்லிங் & விற்பனை பதிவு)
// ==========================================
export function BillingScreen({
  lang,
  onGoToAnalytics,
}: {
  lang: "en-IN" | "hi-IN" | "ta-IN";
  onGoToAnalytics: () => void;
}) {
  const isTamil = lang === "ta-IN";
  const isHindi = lang === "hi-IN";

  const [products, setProducts] = useState<Product[]>(() => getSavedProducts());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"paytm_upi" | "cash">("paytm_upi");

  // Add Product Modal
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [newProdName, setNewProdName] = useState<string>("");
  const [newProdNameTa, setNewProdNameTa] = useState<string>("");
  const [newProdPrice, setNewProdPrice] = useState<string>("");
  const [newProdCategory, setNewProdCategory] = useState<ProductCategory>("tea_coffee");
  const [newProdEmoji, setNewProdEmoji] = useState<string>("☕");

  // Paytm QR Modal State
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [currentBillId, setCurrentBillId] = useState<string>("");
  const [billTotalAmount, setBillTotalAmount] = useState<number>(0);
  const [paymentConfirmed, setPaymentConfirmed] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCategory =
        selectedCategory === "all" || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.nameTa.toLowerCase().includes(q);
      return matchCategory && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart calculations
  const totalAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  }, [cart]);

  const totalQuantity = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Handle Add Custom Product
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdPrice) return;
    const priceNum = parseFloat(newProdPrice);
    if (isNaN(priceNum) || priceNum <= 0) return;

    const newProd: Product = {
      id: "prod_" + Date.now(),
      name: newProdName.trim(),
      nameTa: newProdNameTa.trim() || newProdName.trim(),
      price: Math.round(priceNum),
      category: newProdCategory,
      emoji: newProdEmoji.trim() || "🍽️",
    };

    const updated = [...products, newProd];
    setProducts(updated);
    saveProducts(updated);

    // Reset Form
    setNewProdName("");
    setNewProdNameTa("");
    setNewProdPrice("");
    setShowAddProductModal(false);
  };

  // Generate Paytm QR Code
  const handleOpenPaytmQR = async () => {
    if (totalAmount <= 0) return;

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const billId = `DP-${dateStr.replace(/-/g, "")}-${String(Math.floor(100 + Math.random() * 900))}`;

    setCurrentBillId(billId);
    setBillTotalAmount(totalAmount);
    setPaymentConfirmed(false);

    const upiUrl = buildPaytmUPIUrl({
      amount: totalAmount,
      billId,
      note: `Bill-${billId}`,
    });

    const qrData = await generateQRCode(upiUrl);
    setQrCodeDataUrl(qrData);
    setQrModalOpen(true);
  };

  // Complete Payment (Simulate Paytm Soundbox & Tamil Voice Announcement)
  const handleConfirmPayment = () => {
    if (paymentConfirmed) return;

    setPaymentConfirmed(true);

    // 1. Play authentic Paytm Soundbox chime
    playPaytmChime();

    // 2. Play Tamil Voice Announcement
    setIsSpeaking(true);
    const speechText = isTamil
      ? `Paytm-இல் ${billTotalAmount} ரூபாய் பெறப்பட்டது! நன்றி!`
      : isHindi
        ? `Paytm पर ${billTotalAmount} रुपये प्राप्त हुए! धन्यवाद!`
        : `Received ${billTotalAmount} rupees on Paytm! Thank you!`;

    speakTamil(
      speechText,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false),
    );

    // 3. Save completed bill to repository
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const newBill: Bill = {
      id: currentBillId,
      timestamp: now.toISOString(),
      date: dateStr,
      time: timeStr,
      hour: now.getHours(),
      items: cart.map((item) => ({
        productId: item.product.id,
        name: item.product.name,
        nameTa: item.product.nameTa,
        price: item.product.price,
        quantity: item.quantity,
        itemTotal: item.product.price * item.quantity,
      })),
      totalItems: totalQuantity,
      totalAmount: billTotalAmount,
      paymentMethod,
      status: "completed",
    };

    const existingBills = getSavedBills();
    const updatedBills = [newBill, ...existingBills];
    saveBills(updatedBills);
  };

  const handleNextCustomer = () => {
    setQrModalOpen(false);
    setPaymentConfirmed(false);
    clearCart();
  };

  return (
    <div className="billing-container">
      {/* Top Banner */}
      <div className="billing-topbar">
        <div>
          <h1 className="billing-title">
            {isTamil
              ? "பில்லிங் & விற்பனை பதிவு (POS)"
              : isHindi
                ? "क्विक बिलिंग और POS"
                : "Quick Billing & POS"}
          </h1>
          <p className="billing-subtitle">
            {isTamil
              ? "பொருட்களைச் சேர்த்து உடனடி Paytm QR குறியீட்டை உருவாக்கி கட்டணம் பெறுங்கள்."
              : isHindi
                ? "उत्पाद जोड़ें, तत्काल Paytm QR कोड बनाएं और भुगतान प्राप्त करें।"
                : "Add products, generate instant Paytm QR code, and announce payments in Tamil."}
          </p>
        </div>
        <div className="billing-actions-right">
          <button
            className="secondary-btn"
            onClick={() => setShowAddProductModal(true)}
          >
            <Plus size={16} />
            <span>{isTamil ? "பொருள் சேர்க்க" : "Add Product"}</span>
          </button>
          <button className="primary-btn" onClick={onGoToAnalytics}>
            <TrendingUp size={16} />
            <span>{isTamil ? "விற்பனை பகுப்பாய்வு" : "Sales Analytics"}</span>
          </button>
        </div>
      </div>

      <div className="billing-grid">
        {/* Left Column: Product Catalog */}
        <div className="product-catalog-pane">
          {/* Category Tabs & Search */}
          <div className="catalog-controls">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder={
                  isTamil
                    ? "பொருள் தேடுக (டீ, வடை, காபி...)"
                    : "Search items (Tea, Vada, Coffee...)"
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="clear-search"
                  onClick={() => setSearchQuery("")}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="category-chips">
              <button
                className={`cat-chip ${selectedCategory === "all" ? "active" : ""}`}
                onClick={() => setSelectedCategory("all")}
              >
                {isTamil ? "அனைத்தும்" : isHindi ? "सभी" : "All"}
              </button>
              {(
                [
                  "tea_coffee",
                  "snacks",
                  "bakery_tiffin",
                  "drinks",
                ] as ProductCategory[]
              ).map((cat) => (
                <button
                  key={cat}
                  className={`cat-chip ${selectedCategory === cat ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {isTamil
                    ? CATEGORY_LABELS[cat].ta
                    : CATEGORY_LABELS[cat].en}
                </button>
              ))}
            </div>
          </div>

          {/* Product Items Cards */}
          <div className="product-cards-grid">
            {filteredProducts.map((p) => {
              const inCartItem = cart.find(
                (item) => item.product.id === p.id,
              );
              const inCartCount = inCartItem ? inCartItem.quantity : 0;

              return (
                <button
                  type="button"
                  key={p.id}
                  className={`product-card ${inCartCount > 0 ? "in-cart" : ""}`}
                  onClick={() => addToCart(p)}
                >
                  <div className="product-emoji">{p.emoji}</div>
                  <div className="product-details">
                    <strong className="product-name">
                      {isTamil ? p.nameTa : p.name}
                    </strong>
                    <span className="product-alt-name">
                      {isTamil ? p.name : p.nameTa}
                    </span>
                    <div className="product-price-row">
                      <span className="product-price">₹{p.price}</span>
                      {inCartCount > 0 && (
                        <span className="cart-badge">+{inCartCount}</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: POS Cart & Checkout */}
        <div id="pos-cart-panel" className="pos-cart-pane">
          <div className="cart-header">
            <div className="cart-title-row">
              <ShoppingCart size={18} />
              <h2>{isTamil ? "தற்போதைய பில்" : "Current Bill"}</h2>
            </div>
            {cart.length > 0 && (
              <button
                className="cart-clear-btn"
                onClick={clearCart}
                title="Clear Cart"
              >
                <Trash2 size={15} />
                <span>{isTamil ? "அழிக்க" : "Clear"}</span>
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="cart-items-list">
            {cart.length === 0 ? (
              <div className="cart-empty-state">
                <Store size={36} className="empty-icon" />
                <p>
                  {isTamil
                    ? "பொருட்களை கிளிக் செய்து பில்லில் சேர்க்கவும்"
                    : "Tap items on the left to add to bill"}
                </p>
                <small>
                  {isTamil
                    ? "Paytm QR குறியீடு தானாக உருவாகும்"
                    : "Paytm dynamic QR code will be generated"}
                </small>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product.id} className="cart-row">
                  <div className="cart-row-info">
                    <span className="cart-item-name">
                      {isTamil ? item.product.nameTa : item.product.name}
                    </span>
                    <span className="cart-item-rate">
                      ₹{item.product.price} × {item.quantity}
                    </span>
                  </div>
                  <div className="cart-qty-controls">
                    <button
                      className="qty-btn"
                      onClick={() => updateQuantity(item.product.id, -1)}
                    >
                      -
                    </button>
                    <span className="qty-number">{item.quantity}</span>
                    <button
                      className="qty-btn"
                      onClick={() => updateQuantity(item.product.id, 1)}
                    >
                      +
                    </button>
                  </div>
                  <div className="cart-row-total">
                    ₹{item.product.price * item.quantity}
                  </div>
                  <button
                    type="button"
                    className="cart-row-delete"
                    onClick={() => removeFromCart(item.product.id)}
                    title="Remove item"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary & Pay Options */}
          {cart.length > 0 && (
            <div className="cart-footer">
              <div className="cart-subtotal-row">
                <span>
                  {isTamil ? "மொத்த பொருட்கள்" : "Total Items"}
                </span>
                <span>{totalQuantity}</span>
              </div>
              <div className="cart-total-row">
                <span>{isTamil ? "செலுத்த வேண்டிய தொகை" : "Grand Total"}</span>
                <span className="total-rupees">₹{totalAmount}</span>
              </div>

              {/* Payment Method Selector */}
              <div className="payment-method-switch">
                <button
                  type="button"
                  className={`pm-btn ${paymentMethod === "paytm_upi" ? "selected" : ""}`}
                  onClick={() => setPaymentMethod("paytm_upi")}
                >
                  <QrCode size={16} />
                  <span>Paytm UPI QR</span>
                </button>
                <button
                  type="button"
                  className={`pm-btn ${paymentMethod === "cash" ? "selected" : ""}`}
                  onClick={() => setPaymentMethod("cash")}
                >
                  <IndianRupee size={16} />
                  <span>{isTamil ? "ரொக்கம் (Cash)" : "Cash"}</span>
                </button>
              </div>

              {/* QR Checkout Trigger */}
              <button
                className="paytm-checkout-btn"
                onClick={handleOpenPaytmQR}
              >
                <QrCode size={20} />
                <span>
                  {paymentMethod === "paytm_upi"
                    ? isTamil
                      ? `Paytm QR உருவாக்கு (₹${totalAmount})`
                      : `Generate Paytm QR (₹${totalAmount})`
                    : isTamil
                      ? `ரொக்கம் செலுத்துதல் (₹${totalAmount})`
                      : `Receive Cash (₹${totalAmount})`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Floating Cart Summary Button */}
      {cart.length > 0 && !qrModalOpen && (
        <button
          type="button"
          className="mobile-cart-float-bar"
          onClick={() => {
            const el = document.getElementById("pos-cart-panel");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <span>🛒 {totalQuantity} {isTamil ? "பொருட்கள்" : "Items"} · ₹{totalAmount}</span>
          <span>{isTamil ? "பில் பார்க்க / பணம் செலுத்த →" : "View Cart & Pay →"}</span>
        </button>
      )}

      {/* ========================================== */}
      {/* PAYTM QR CODE & SOUNDBOX MODAL */}
      {/* ========================================== */}
      {qrModalOpen && (
        <div className="modal-backdrop">
          <div className="paytm-qr-modal">
            {/* Branded Paytm Soundbox Standee Header */}
            <div className="paytm-standee-header">
              <div className="paytm-header-brand">
                <span className="paytm-logo-text">Paytm</span>
                <span className="paytm-accepted">
                  {isTamil ? "ஏற்கப்படும்" : "Accepted Here"}
                </span>
              </div>
              <button
                className="close-modal-btn"
                onClick={() => setQrModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="paytm-modal-body">
              {/* Shop info & Bill ID */}
              <div className="standee-shop-info">
                <strong>
                  {isTamil
                    ? PAYTM_DEFAULT_CONFIG.merchantNameTa
                    : PAYTM_DEFAULT_CONFIG.merchantName}
                </strong>
                <span className="standee-bill-id">{currentBillId}</span>
              </div>

              {/* QR Code Container */}
              <div className="standee-qr-frame">
                {qrCodeDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={qrCodeDataUrl}
                    alt="Paytm Dynamic QR"
                    className="paytm-qr-image"
                  />
                ) : (
                  <div className="qr-skeleton">QR Generating...</div>
                )}
                <div className="standee-upi-icons">
                  <span>Paytm</span> • <span>GPay</span> • <span>PhonePe</span>{" "}
                  • <span>BHIM UPI</span>
                </div>
              </div>

              {/* Amount Display */}
              <div className="standee-amount-pill">
                <span className="amount-label">
                  {isTamil ? "தொகை" : "Amount"}
                </span>
                <span className="amount-value">₹{billTotalAmount}</span>
              </div>

              {/* Paytm Soundbox Simulation Box */}
              {!paymentConfirmed ? (
                <div className="soundbox-box">
                  <p className="soundbox-hint">
                    {isTamil
                      ? "வாடிக்கையாளர் ஸ்கேன் செய்தவுடன் 'கட்டணம் செலுத்து' கிளிக் செய்து Paytm Soundbox தமிழ் ஒலி அறிவிப்பைக் கேளுங்கள்:"
                      : "Simulate merchant soundbox voice announcement in Tamil:"}
                  </p>
                  <button
                    className="paytm-soundbox-play-btn"
                    onClick={handleConfirmPayment}
                  >
                    <Volume2 size={20} className="pulse-icon" />
                    <span>
                      {isTamil
                        ? "கட்டணம் உறுதி & ஒலி அறிவிப்பு (Simulate Voice)"
                        : "Confirm & Play Paytm Soundbox Voice"}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="payment-success-card">
                  <div className="success-header">
                    <CheckCircle2 size={32} className="success-icon" />
                    <div>
                      <h3>
                        {isTamil
                          ? "கட்டணம் வெற்றிகரமாக பெறப்பட்டது!"
                          : "Payment Received Successfully!"}
                      </h3>
                      <p className="voice-transcript">
                        🔊 &ldquo;Paytm-இல் {billTotalAmount} ரூபாய் பெறப்பட்டது!
                        நன்றி!&rdquo;
                      </p>
                    </div>
                  </div>

                  {isSpeaking && (
                    <div className="soundwave-bar">
                      <span className="wave"></span>
                      <span className="wave"></span>
                      <span className="wave"></span>
                      <span className="wave"></span>
                      <span className="wave-text">
                        {isTamil ? "ஒலி அறிவிப்பு ஒலிக்கிறது..." : "Speaking in Tamil..."}
                      </span>
                    </div>
                  )}

                  <div className="success-actions">
                    <button
                      className="print-btn"
                      onClick={() => window.print()}
                    >
                      <Printer size={16} />
                      <span>{isTamil ? "ரசீது அச்சிடுக" : "Print Receipt"}</span>
                    </button>
                    <button
                      className="next-customer-btn"
                      onClick={handleNextCustomer}
                    >
                      <ArrowRight size={16} />
                      <span>
                        {isTamil ? "அடுத்த வாடிக்கையாளர்" : "Next Customer"}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* ADD CUSTOM PRODUCT MODAL */}
      {/* ========================================== */}
      {showAddProductModal && (
        <div className="modal-backdrop">
          <div className="add-product-modal">
            <div className="modal-header">
              <h3>
                {isTamil ? "புதிய பொருள் சேர்க்க" : "Add New Product"}
              </h3>
              <button
                className="close-modal-btn"
                onClick={() => setShowAddProductModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddProduct} className="modal-form">
              <label>
                <span>{isTamil ? "பொருள் பெயர் (ஆங்கிலம்)" : "Item Name (English)"}</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ginger Tea"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                />
              </label>

              <label>
                <span>{isTamil ? "பொருள் பெயர் (தமிழ்)" : "Item Name (Tamil)"}</span>
                <input
                  type="text"
                  placeholder="e.g. இஞ்சி டீ"
                  value={newProdNameTa}
                  onChange={(e) => setNewProdNameTa(e.target.value)}
                />
              </label>

              <div className="form-row-2">
                <label>
                  <span>{isTamil ? "விலை (₹)" : "Price (₹)"}</span>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="15"
                    value={newProdPrice}
                    onChange={(e) => setNewProdPrice(e.target.value)}
                  />
                </label>

                <label>
                  <span>{isTamil ? "பிரிவு" : "Category"}</span>
                  <select
                    value={newProdCategory}
                    onChange={(e) =>
                      setNewProdCategory(e.target.value as ProductCategory)
                    }
                  >
                    <option value="tea_coffee">Tea & Coffee (டீ & காபி)</option>
                    <option value="snacks">Snacks (சிற்றுண்டி)</option>
                    <option value="bakery_tiffin">Bakery & Tiffin (டிபன்)</option>
                    <option value="drinks">Drinks & Milk (குளிர் பானம்)</option>
                    <option value="other">Other (மற்றவை)</option>
                  </select>
                </label>
              </div>

              <label>
                <span>{isTamil ? "சின்னம் (Emoji)" : "Icon / Emoji"}</span>
                <input
                  type="text"
                  value={newProdEmoji}
                  onChange={(e) => setNewProdEmoji(e.target.value)}
                  placeholder="☕, 🥯, 🥟, 🥐..."
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setShowAddProductModal(false)}
                >
                  {isTamil ? "ரத்து" : "Cancel"}
                </button>
                <button type="submit" className="primary-btn">
                  {isTamil ? "சேமி" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// ANALYTICS SCREEN (விற்பனை & நேர பகுப்பாய்வு)
// ==========================================
export function AnalyticsScreen({
  lang,
  onGoToBilling,
  onGoToActions,
}: {
  lang: "en-IN" | "hi-IN" | "ta-IN";
  onGoToBilling: () => void;
  onGoToActions: () => void;
}) {
  const isTamil = lang === "ta-IN";
  const isHindi = lang === "hi-IN";

  const [selectedDate, setSelectedDate] = useState<string>("2026-11-15");
  const [bills] = useState<Bill[]>(() => getSavedBills());
  const [products] = useState<Product[]>(() => getSavedProducts());
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [spokenTranscript, setSpokenTranscript] = useState<string>("");

  const analytics = useMemo(() => {
    return computeSalesAnalytics(bills, selectedDate, products);
  }, [bills, selectedDate, products]);

  const availableDates = useMemo(() => {
    return [...new Set(bills.map((b) => b.date))].sort().reverse();
  }, [bills]);

  // Voice playback triggers
  const handlePlayVoice = (text: string) => {
    setSpokenTranscript(text);
    setIsSpeaking(true);
    speakTamil(
      text,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false),
    );
  };

  const handleStopVoice = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  return (
    <div className="analytics-container">
      {/* Top Header */}
      <div className="analytics-topbar">
        <div>
          <h1 className="analytics-title">
            {isTamil
              ? "விற்பனை & நேர பகுப்பாய்வு"
              : isHindi
                ? "बिक्री और समय विश्लेषण"
                : "Sales & Time Analytics"}
          </h1>
          <p className="analytics-subtitle">
            {isTamil
              ? "எந்தப் பொருட்கள் அதிகம் விற்றன, எந்த நேரத்தில் விற்பனை மந்தமாக இருந்தது, மற்றும் தினசரி விவரங்கள்."
              : isHindi
                ? "कौन से उत्पाद बिके, किस समय बिक्री नहीं हुई, और दिनवार विवरण।"
                : "Track product volumes, identify inactive dead hours, and review daily sales."}
          </p>
        </div>
        <div className="analytics-actions-right">
          <button className="secondary-btn" onClick={onGoToBilling}>
            <ShoppingCart size={16} />
            <span>{isTamil ? "பில்லிங் செல்ல" : "Go to Billing"}</span>
          </button>
        </div>
      </div>

      {/* Date Selector Row & Voice Assistant Pill */}
      <div className="date-filter-bar">
        <div className="filter-chips">
          <span className="filter-label">
            <Calendar size={16} />
            {isTamil ? "தேதி:" : "Date:"}
          </span>
          {[
            ...availableDates.map((d, idx) => ({
              id: d,
              label:
                idx === 0
                  ? isTamil ? `இன்று (${d.slice(8)} Nov)` : `Today (${d.slice(8)} Nov)`
                  : idx === 1
                  ? isTamil ? `நேற்று (${d.slice(8)} Nov)` : `Yesterday (${d.slice(8)} Nov)`
                  : `${d.slice(8)} Nov`,
            })),
            { id: "all", label: isTamil ? "அனைத்து 6 நாட்கள்" : "All 6 Days" },
          ].map((d) => (
            <button
              key={d.id}
              className={`date-chip ${selectedDate === d.id ? "active" : ""}`}
              onClick={() => setSelectedDate(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Tamil Voice Briefing Button */}
        <div className="voice-control-group">
          {!isSpeaking ? (
            <button
              className="voice-play-pill"
              onClick={() => handlePlayVoice(analytics.voiceBriefingTa)}
            >
              <Volume2 size={18} className="pulse-icon" />
              <span>{isTamil ? "தமிழில் குரல் அறிக்கை கேட்க" : "Listen in Tamil"}</span>
            </button>
          ) : (
            <button className="voice-stop-pill" onClick={handleStopVoice}>
              <VolumeX size={18} />
              <span>{isTamil ? "நிறுத்துக" : "Stop Voice"}</span>
            </button>
          )}
        </div>
      </div>

      {/* TAMIL VOICE ASSISTANT CARD */}
      <div className="tamil-voice-card">
        <div className="voice-card-header">
          <div className="voice-card-title">
            <Volume2 size={20} className="text-cyan" />
            <h3>
              {isTamil
                ? "குரல் வழி வணிக வழிகாட்டி (Tamil Voice Assistant)"
                : "Tamil Voice Assistant"}
            </h3>
          </div>
          <div className="quick-voice-prompts">
            <button
              className="prompt-chip"
              onClick={() => handlePlayVoice(analytics.voiceBriefingTa)}
            >
              🔊 {isTamil ? "முழு அறிக்கை" : "Full Summary"}
            </button>
            <button
              className="prompt-chip alert-chip"
              onClick={() => handlePlayVoice(analytics.deadHoursWarningTa)}
            >
              ⚠️ {isTamil ? "மந்தமான நேரம்" : "Dead Hours"}
            </button>
            <button
              className="prompt-chip success-chip"
              onClick={() =>
                handlePlayVoice(
                  analytics.topSellingProduct
                    ? `இன்று அதிகம் விற்ற பொருள் ${analytics.topSellingProduct.nameTa}, மொத்தம் ${analytics.topSellingProduct.unitsSold} விற்று ரூபாய் ${analytics.topSellingProduct.totalRevenue} வசூலானது.`
                    : "இன்று விற்பனை இன்னும் பதிவாகவில்லை.",
                )
              }
            >
              🏆 {isTamil ? "அதிகம் விற்ற பொருள்" : "Top Item"}
            </button>
          </div>
        </div>

        {/* Spoken Transcript display */}
        <div className="voice-transcript-box">
          <p>
            {spokenTranscript ||
              analytics.voiceBriefingTa}
          </p>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="kpi-cards-grid">
        <div className="kpi-card">
          <span className="kpi-label">
            {isTamil ? "மொத்த வருவாய்" : "Total Revenue"}
          </span>
          <strong className="kpi-value text-cyan">
            ₹{analytics.totalRevenue}
          </strong>
          <small className="kpi-sub">
            {isTamil ? "பதிவான பில்கள்" : "Recorded Sales"}
          </small>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">
            {isTamil ? "பில்கள் எண்ணிக்கை" : "Total Bills"}
          </span>
          <strong className="kpi-value">{analytics.totalBills}</strong>
          <small className="kpi-sub">
            {isTamil ? "சராசரி பில்: ₹" : "Avg Bill: ₹"}
            {analytics.averageBillValue}
          </small>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">
            {isTamil ? "விற்பனையான பொருட்கள்" : "Total Items Sold"}
          </span>
          <strong className="kpi-value">{analytics.totalUnitsSold}</strong>
          <small className="kpi-sub">
            {isTamil ? "மொத்த எண்ணிக்கைகள்" : "Units Dispensed"}
          </small>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">
            {isTamil ? "Paytm UPI பங்கு" : "Paytm UPI Share"}
          </span>
          <strong className="kpi-value text-blue">
            {analytics.paytmUpiSharePercent}%
          </strong>
          <small className="kpi-sub">
            {isTamil ? "QR மூலம் பெறப்பட்டது" : "Via Dynamic QR"}
          </small>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: INACTIVE & DEAD HOURS (எந்த நேரம் விற்பனை ஆகல) */}
      {/* ======================================================== */}
      <div className="analytics-section dead-hours-section">
        <div className="section-head">
          <div className="section-title-wrap">
            <Clock3 size={20} className="text-amber" />
            <div>
              <h2>
                {isTamil
                  ? "நேர வாரியான விற்பனை & மந்தமான நேரங்கள் (Time & Dead Hours)"
                  : "Hourly Breakdown & Inactive Hours"}
              </h2>
              <p>
                {isTamil
                  ? "எந்த நேரத்தில் விற்பனை நடந்தது, எந்த நேரத்தில் விற்பனை மந்தமாக இருந்தது அல்லது நடக்கவில்லை என்பதை விளக்குகிறது."
                  : "Tracks peak rush hours and explicitly flags quiet/dead windows with zero sales."}
              </p>
            </div>
          </div>
        </div>

        {/* Dead hours callout banner */}
        {analytics.deadHours.length > 0 && (
          <div className="dead-hours-callout">
            <div className="callout-icon">
              <AlertTriangle size={24} />
            </div>
            <div className="callout-content">
              <strong>
                {isTamil
                  ? "விற்பனை மந்தமான / நடக்காத நேரங்கள் கண்டறியப்பட்டன!"
                  : "Inactive / Dead Hours Detected!"}
              </strong>
              <p>
                {isTamil
                  ? `மதியம் ${analytics.deadHours.map((d) => d.hourLabel).join(", ")} நேரங்களில் விற்பனை ஏதும் நடக்கவில்லை அல்லது மிகக் குறைவாக இருந்தது.`
                  : `During ${analytics.deadHours.map((d) => d.hourLabel).join(", ")}, customer count was zero or minimal.`}
              </p>
              <div className="recommendation-badge">
                <Sparkles size={16} />
                <span>{analytics.actionRecommendationTa}</span>
              </div>
            </div>
            <button className="action-pill-btn" onClick={onGoToActions}>
              <span>{isTamil ? "சலுகை உருவாக்குக" : "Create Offer"}</span>
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* 24-Hour Timeline Bar Chart */}
        <div className="hourly-chart-card">
          <div className="chart-legend">
            <span className="legend-item">
              <span className="dot dot-peak"></span>
              {isTamil ? "பீக் நேரம் (அதிக விற்பனை)" : "Peak Rush"}
            </span>
            <span className="legend-item">
              <span className="dot dot-normal"></span>
              {isTamil ? "சாதாரண விற்பனை" : "Normal"}
            </span>
            <span className="legend-item">
              <span className="dot dot-dead"></span>
              {isTamil ? "மந்தமான நேரம் (விற்பனை இல்லை)" : "Dead / Zero Sales"}
            </span>
          </div>

          <div className="timeline-bars">
            {analytics.hourlyStats.map((h) => {
              const heightPercent = Math.min(
                100,
                Math.max(6, Math.round((h.totalRevenue / 500) * 100)),
              );

              return (
                <div key={h.hour} className="timeline-col">
                  <div className="bar-wrapper">
                    <div
                      className={`timeline-bar ${
                        h.isPeak
                          ? "bar-peak"
                          : h.isDead
                            ? "bar-dead"
                            : "bar-normal"
                      }`}
                      style={{ height: `${heightPercent}%` }}
                      title={`${h.hourLabel}: ₹${h.totalRevenue} (${h.billsCount} bills)`}
                    >
                      {h.billsCount > 0 && (
                        <span className="bar-val">₹{h.totalRevenue}</span>
                      )}
                    </div>
                  </div>
                  <span className="timeline-hour">{h.hour}:00</span>
                  {h.isDead && (
                    <span className="dead-tag">
                      {isTamil ? "மந்தம்" : "Dead"}
                    </span>
                  )}
                  {h.isPeak && (
                    <span className="peak-tag">
                      <Flame size={12} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 2: PRODUCT SALES BREAKDOWN (எவ்வளவு பொருள் விற்பனை) */}
      {/* ======================================================== */}
      <div className="analytics-section">
        <div className="section-head">
          <div className="section-title-wrap">
            <Award size={20} className="text-cyan" />
            <div>
              <h2>
                {isTamil
                  ? "பொருள் வாரியான விற்பனை விவரம் (Product-wise Sales)"
                  : "Product Sales & Popularity"}
              </h2>
              <p>
                {isTamil
                  ? "எந்தப் பொருள் எத்தனை எண்ணிக்கையில் விற்றது, எவ்வளவு வருவாய் கிடைத்தது என்ற விவரம்."
                  : "Quantities sold and revenue contribution for each menu item."}
              </p>
            </div>
          </div>
        </div>

        {/* Top Product Spotlight */}
        {analytics.topSellingProduct && (
          <div className="top-product-spotlight">
            <div className="spotlight-emoji">
              {analytics.topSellingProduct.emoji}
            </div>
            <div className="spotlight-details">
              <div className="spotlight-badge">
                🏆 {isTamil ? "இன்றைய முதலிடம்" : "#1 Best Seller"}
              </div>
              <h3>
                {isTamil
                  ? analytics.topSellingProduct.nameTa
                  : analytics.topSellingProduct.name}
              </h3>
              <p>
                {isTamil
                  ? `மொத்தம் ${analytics.topSellingProduct.unitsSold} எண்ணிக்கையில் விற்று, ₹${analytics.topSellingProduct.totalRevenue} வருவாய் ஈட்டியுள்ளது. (மொத்த விற்பனையில் ${analytics.topSellingProduct.revenuePercent}%)`
                  : `Sold ${analytics.topSellingProduct.unitsSold} units generating ₹${analytics.topSellingProduct.totalRevenue} (${analytics.topSellingProduct.revenuePercent}% of daily revenue).`}
              </p>
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="table-card">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>{isTamil ? "பொருள்" : "Product"}</th>
                <th>{isTamil ? "பிரிவு" : "Category"}</th>
                <th>{isTamil ? "விலை" : "Price"}</th>
                <th>{isTamil ? "விற்ற எண்ணிக்கை" : "Units Sold"}</th>
                <th>{isTamil ? "மொத்த வருவாய்" : "Revenue"}</th>
                <th>{isTamil ? "பங்கு (%)" : "Share"}</th>
              </tr>
            </thead>
            <tbody>
              {analytics.productStats.map((p) => (
                <tr key={p.productId}>
                  <td className="product-cell">
                    <span className="p-emoji">{p.emoji}</span>
                    <div>
                      <strong>{isTamil ? p.nameTa : p.name}</strong>
                      <small>{isTamil ? p.name : p.nameTa}</small>
                    </div>
                  </td>
                  <td>
                    <span className="cat-badge">
                      {isTamil
                        ? CATEGORY_LABELS[p.category]?.ta
                        : CATEGORY_LABELS[p.category]?.en}
                    </span>
                  </td>
                  <td>₹{p.unitPrice}</td>
                  <td>
                    <span className="units-pill">{p.unitsSold}</span>
                  </td>
                  <td>
                    <strong>₹{p.totalRevenue}</strong>
                  </td>
                  <td className="share-cell">
                    <div className="progress-bar-wrap">
                      <div
                        className="progress-fill"
                        style={{ width: `${p.revenuePercent}%` }}
                      ></div>
                    </div>
                    <span>{p.revenuePercent}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 3: DAY-WISE PRODUCT SALES (தினசரி எந்தப் பொருள் எவ்வளவு) */}
      {/* ======================================================== */}
      <div className="analytics-section">
        <div className="section-head">
          <div className="section-title-wrap">
            <Calendar size={20} className="text-cyan" />
            <div>
              <h2>
                {isTamil
                  ? "தினசரி பொருள் விற்பனை ஒப்பீடு (Day-wise Breakdown)"
                  : "Day-wise Sales & Trends"}
              </h2>
              <p>
                {isTamil
                  ? "ஒவ்வொரு நாளும் எந்தெந்தப் பொருள் எவ்வளவு விற்றது என்ற நாள் வாரியான ஒப்பீடு."
                  : "Daily sales comparison showing exact item quantities sold per day."}
              </p>
            </div>
          </div>
        </div>

        <div className="daywise-cards-grid">
          {analytics.dayWiseStats.map((day) => (
            <div key={day.date} className="daywise-card">
              <div className="daywise-header">
                <div>
                  <strong>{day.dayLabel}</strong>
                  <span className="daywise-date">{day.date}</span>
                </div>
                <div className="daywise-totals">
                  <span className="day-rev">₹{day.totalRevenue}</span>
                  <span className="day-bills">
                    {day.billsCount} {isTamil ? "பில்கள்" : "bills"}
                  </span>
                </div>
              </div>

              <div className="daywise-products-list">
                <span className="list-title">
                  {isTamil ? "விற்ற பொருட்கள்:" : "Items Sold:"}
                </span>
                <div className="day-items-chips">
                  {day.products.map((item) => (
                    <div key={item.productId} className="day-item-pill">
                      <span className="item-name">
                        {isTamil ? item.nameTa : item.name}
                      </span>
                      <span className="item-qty">×{item.unitsSold}</span>
                      <span className="item-rev">₹{item.revenue}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
