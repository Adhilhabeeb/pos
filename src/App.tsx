import React, { useEffect, useRef, useState, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getStorage, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getDatabase, ref, onValue, get } from 'firebase/database';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import {
  Search,
  Camera,
  ShoppingCart,
  Trash2,
  Pause,
  RefreshCw,
  Plus,
  Minus,
  CheckCircle2,
  X,
  CreditCard,
  DollarSign,
  Smartphone,
  Upload,
  Sparkles,
  Sun,
  Moon,
  ChevronRight,
  Receipt,
  RotateCcw,
  FolderOpen,
  Printer,
  Mail,
  ArrowRight,
  Settings,
  History,
  SlidersHorizontal,
  Clock,
  Database,
  Calendar,
  Eye,
  User,
  Shield
} from 'lucide-react';

import { collection, query, orderBy, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

import { Product, CartItem, HeldOrder, Category, Variant } from './types';
import ProductCard from './components/ProductCard';
import ScannerModal from './components/ScannerModal';
import ReceiptPrint from './components/ReceiptPrint';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { check, savePayment } from '@/lib/firebasefunbctioins';
import { uploadUPIpaymentScreenshots } from '@/lib/storage/storage';
import { storageBUCKET } from '@/lib/storage/storageconfig';
import { dclubapp as app } from '@/lib/storage/storageconfig';

// ==========================================
// STATIC CONSTANTS & FIREBASE SETUP
// ==========================================

const database = getDatabase(app);

// Bulletproof fallback POS catalog when Firebase dataset is loading or offline
const FALLBACK_CATEGORIES: Category[] = [
  { code: "grocery", name: "Groceries" },
  { code: "drinks", name: "Beverages" },
  { code: "snacks", name: "Snacks & Munchies" },
  { code: "fresh", name: "Fruits & Veggies" }
];

const FALLBACK_PRODUCTS: Product[] = [
  {
    id: "fb_rice_01",
    name: "Premium Dehraduni Basmati Rice",
    cat: "Groceries",
    categoryCode: "grocery",
    price: 95,
    mrp: 115,
    pic: "",
    details: "Aromatic long-grain basmati rice perfect for biryanis.",
    variants: [
      { vId: "1kg", price: 95, mrp: 115, stockQty: 45, unitValue: "1", unit: "kg", tax: 5 },
      { vId: "5kg", price: 440, mrp: 550, stockQty: 20, unitValue: "5", unit: "kg", tax: 5 }
    ]
  },
  {
    id: "fb_apple_02",
    name: "Organic Red Fuji Apples",
    cat: "Fruits & Veggies",
    categoryCode: "fresh",
    price: 130,
    mrp: 160,
    pic: "",
    details: "Crisp, crunchy, and freshly harvested directly from Himachal orchards.",
    variants: [
      { vId: "500g", price: 130, mrp: 160, stockQty: 30, unitValue: "500", unit: "g", tax: 0 },
      { vId: "1kg", price: 240, mrp: 300, stockQty: 15, unitValue: "1", unit: "kg", tax: 0 }
    ]
  },
  {
    id: "fb_chips_03",
    name: "Golden Crust Potato Chips",
    cat: "Snacks & Munchies",
    categoryCode: "snacks",
    price: 30,
    mrp: 35,
    pic: "",
    details: "Lightly salted hand-cooked natural sea salt chips.",
    variants: [
      { vId: "std", price: 30, mrp: 35, stockQty: 100, unitValue: "120", unit: "g", tax: 18 }
    ]
  },
  {
    id: "fb_milk_04",
    name: "Organic Whole Pasteurized Milk",
    cat: "Groceries",
    categoryCode: "grocery",
    price: 32,
    mrp: 36,
    pic: "",
    details: "A-Grade pasteurized farmhouse milk.",
    variants: [
      { vId: "500ml", price: 32, mrp: 36, stockQty: 60, unitValue: "500", unit: "ml", tax: 5 },
      { vId: "1L", price: 60, mrp: 70, stockQty: 40, unitValue: "1", unit: "L", tax: 5 }
    ]
  },
  {
    id: "fb_cocacola_05",
    name: "Coca Cola Classic Soda Can",
    cat: "Beverages",
    categoryCode: "drinks",
    price: 40,
    mrp: 45,
    pic: "",
    details: "Chilled effervescent Coca Cola classic refreshment.",
    variants: [
      { vId: "can", price: 40, mrp: 45, stockQty: 80, unitValue: "330", unit: "ml", tax: 18 }
    ]
  },
  {
    id: "fb_cookies_06",
    name: "Choco Chip Almond Cookies",
    cat: "Snacks & Munchies",
    categoryCode: "snacks",
    price: 75,
    mrp: 90,
    pic: "",
    details: "Indulgent cookies laden with actual Hershey's chocolate chunks.",
    variants: [
      { vId: "pack", price: 75, mrp: 90, stockQty: 25, unitValue: "150", unit: "g", tax: 12 }
    ]
  }
];

export default function App() {
  // ==========================================
  // COMPONENT STATE REGISTRY
  // ==========================================

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const cachedCart = localStorage.getItem('pos_cart');
      return cachedCart ? JSON.parse(cachedCart) : [];
    } catch {
      return [];
    }
  });
  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(true);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [isThemeLight, setIsThemeLight] = useState<boolean>(false);
  const [orderId, setOrderId] = useState<string>('#10001');

  // Active Modals & Overlay triggers
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isUpiModalOpen, setIsUpiModalOpen] = useState<boolean>(false);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState<boolean>(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [activeReceipt, setActiveReceipt] = useState<{
    orderId: string;
    cart: CartItem[];
    paymentMethod: string;
    receivedAmount: number;
    changeDue: number;
    totals: {
      subtotal: number;
      discount: number;
      tax: number;
      grandTotal: number;
    };
    dateTimeString: string;
  } | null>(null);

  // Email dispatch drawer states
  const [simulatedEmailBoxOpen, setSimulatedEmailBoxOpen] = useState<boolean>(false);
  const [simulatedEmail, setSimulatedEmail] = useState<string>('');
  const [simulatedEmailSending, setSimulatedEmailSending] = useState<boolean>(false);

  const handleSimulatedEmailSubmit = () => {
    if (!simulatedEmail) return;
    setSimulatedEmailSending(true);
    setTimeout(() => {
      setSimulatedEmailSending(false);
      setSimulatedEmailBoxOpen(false);
      addToast(`Receipt successfully sent to ${simulatedEmail}`, "success");
      setSimulatedEmail('');
    }, 1100);
  };
  
  // Mobile UI controls
  const [isCartOpenOnMobile, setIsCartOpenOnMobile] = useState<boolean>(false);

  // Settings/Left drawer support state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [historyPayments, setHistoryPayments] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'receiver'>('history');

  // Loaded state for payment owner (Adhil Business POS)
  const [paymentOwnerUpi, setPaymentOwnerUpi] = useState<string>("hafizhamsa015@oksbi");
  const [paymentOwnerName, setPaymentOwnerName] = useState<string>("Adhil Business Limited");
  
  // Local edit states inside control drawer
  const [editOwnerUpi, setEditOwnerUpi] = useState<string>("hafizhamsa015@oksbi");
  const [editOwnerName, setEditOwnerName] = useState<string>("Adhil Business Limited");
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState<boolean>(false);
  const [isSavingOwner, setIsSavingOwner] = useState<boolean>(false);

  // Load payment owner from collection "paymentowner"
  useEffect(() => {
    try {
      const ownerRef = collection(db, 'paymentowner');
      const q = query(ownerRef);
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.upiId) {
              setPaymentOwnerUpi(data.upiId);
              setEditOwnerUpi(data.upiId);
            }
            if (data.name) {
              setPaymentOwnerName(data.name);
              setEditOwnerName(data.name);
            }
          });
        }
      }, (error) => {
        console.error("Error reading paymentowner collection in real-time:", error);
      });
      return () => unsubscribe();
    } catch (err) {
      console.error("Firestore setup error for payment owner listener:", err);
    }
  }, []);

  // Variant dialog parameters
  const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number>(0);

  // Cash computation fields
  const [cashReceived, setCashReceived] = useState<string>('');
  const [cardReferenceNumber, setCardReferenceNumber] = useState<string>('');
  const [selectedPayMethod, setSelectedPayMethod] = useState<string>('Cash');

  // Load real-time transactions from the Firestore database "db" (for prat-16d46)
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    if (isSettingsOpen) {
      setIsHistoryLoading(true);
      try {
        const paymentsRef = collection(db, 'payments');
        // Sort by createdAt desc
        const q = query(paymentsRef, orderBy('createdAt', 'desc'));
        unsubscribe = onSnapshot(q, (snapshot) => {
          const loadedPayments: any[] = [];
          snapshot.forEach((doc) => {
            loadedPayments.push({ id: doc.id, ...doc.data() });
          });
          setHistoryPayments(loadedPayments);
          setIsHistoryLoading(false);
        }, (error) => {
          console.error("Firestore loading error, attempting fallback:", error);
          // Fallback query if index is not ready yet
          const fallbackQ = query(paymentsRef);
          onSnapshot(fallbackQ, (snapshot) => {
            const loadedPayments: any[] = [];
            snapshot.forEach((doc) => {
              loadedPayments.push({ id: doc.id, ...doc.data() });
            });
            // Client-side sort safely as a backup
            loadedPayments.sort((a, b) => {
              const bTime = b.createdAt?.seconds || b.createdAt?.toMillis?.() || new Date(b.dateTimeString).getTime() || 0;
              const aTime = a.createdAt?.seconds || a.createdAt?.toMillis?.() || new Date(a.dateTimeString).getTime() || 0;
              return bTime - aTime;
            });
            setHistoryPayments(loadedPayments);
            setIsHistoryLoading(false);
          });
        });
      } catch (err) {
        console.error("Setup Firestore error:", err);
        setIsHistoryLoading(false);
      }
    }
    return () => {
      unsubscribe();
    };
  }, [isSettingsOpen]);

  // Animation support
  const [flyingItems, setFlyingItems] = useState<any[]>([]);
  const [cartBouncing, setCartBouncing] = useState<boolean>(false);
  const [toasts, setToasts] = useState<any[]>([]);

  // Timer for UPI expires mode
  const [upiTimer, setUpiTimer] = useState<number>(150); // 2:30 in seconds
  const upiTimerRef = useRef<any>(null);

  // Image Upload screen verification fields
  const [screenshotPreview, setScreenshotPreview] = useState<string>('');
  const [screenshotFileUploaded, setScreenshotFileUploaded] = useState<boolean>(false);

  // Camera state fields
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // References for Fly mechanics
  const cartTargetRef = useRef<HTMLButtonElement | null>(null);

  // QR Code canvas elements url source
  const [upiQrCodeDataUrl, setUpiQrCodeDataUrl] = useState<string>('');

  // ==========================================
  // SYNC UTILITY & TOAST WRAPPER
  // ==========================================

  const addToast = (message: string, type: 'success' | 'info' | 'warn' = 'success') => {
    // Toast feature completely removed for high performance checkout
  };

  const generateNewOrderId = () => {
    setOrderId('#' + Math.floor(10000 + Math.random() * 90000));
  };

  // ==========================================
  // REAL-TIME DATABASE SYNCHRONIZER
  // ==========================================

  // Persist cart to localStorage when updated
  useEffect(() => {
    try {
      localStorage.setItem('pos_cart', JSON.stringify(cart));
    } catch (e) {
      console.error("Failed to persist cart.", e);
    }
  }, [cart]);

  useEffect(() => {
    // Generate initial order reference
    generateNewOrderId();

    // Setup local storage cache
    const cachedCats = localStorage.getItem('pos_categories');
    const cachedProds = localStorage.getItem('pos_products');
    const cachedStock = localStorage.getItem('pos_stock');

    if (cachedCats && cachedProds && cachedStock) {
      try {
        const dbCatsObj = JSON.parse(cachedCats);
        const dbProdsObj = JSON.parse(cachedProds);
        const dbStockObj = JSON.parse(cachedStock);
        compileProducts(dbCatsObj, dbProdsObj, dbStockObj);
        setIsProductsLoading(false);
      } catch (e) {
        console.error("Local POS cache corrupt.", e);
        // Fallback feed
        setCategories(FALLBACK_CATEGORIES);
        setProducts(FALLBACK_PRODUCTS);
        setIsProductsLoading(true);
      }
    } else {
      // Feed fallbacks initially on fresh boot to speed up interactive readiness
      setCategories(FALLBACK_CATEGORIES);
      setProducts(FALLBACK_PRODUCTS);
      setIsProductsLoading(true);
    }

    // Connect To Live Real-time Database
    try {
      const parentNodeRef = ref(database, 'root');
      onValue(parentNodeRef, (snapshot) => {
        const rootData = snapshot.val();
        if (rootData) {
          const dbCats = rootData.category || {};
          const dbProds = rootData.products || {};
          const dbStock = rootData.stock || {};

          // Persist in client storage for offline resilient boots
          localStorage.setItem('pos_categories', JSON.stringify(dbCats));
          localStorage.setItem('pos_products', JSON.stringify(dbProds));
          localStorage.setItem('pos_stock', JSON.stringify(dbStock));

          compileProducts(dbCats, dbProds, dbStock);
          setIsProductsLoading(false);
        } else {
          setIsProductsLoading(false);
        }
      }, (error) => {
        console.warn("Firebase Database blocked or offline. Operating on fallback mode.", error);
        addToast("Operating in resilient local mode", "info");
        setIsProductsLoading(false);
      });
    } catch (err) {
      console.error("Firebase startup crash halted.", err);
      setIsProductsLoading(false);
    }
  }, []);

  const compileProducts = (dbCats: any, dbProds: any, dbStock: any) => {
    // Standardize Category lists
    const catList: Category[] = Object.entries(dbCats).map(([code, value]: [string, any]) => ({
      code,
      name: value.name || code
    }));
    setCategories(catList);

    // Build unified product maps matching details and stock variants
    const productList: Product[] = Object.entries(dbProds).map(([pId, data]: [string, any]) => {
      const mappedCategoryName = dbCats[data.categoryCode]?.name || data.categoryCode || 'Uncategorized';
      const variantNodes = dbStock[pId] || {};

      const variants: Variant[] = Object.entries(variantNodes).map(([vId, vData]: [string, any]) => {
        let price = parseFloat(vData.offerPrice || vData.mrp || vData.ogPrice || 0);
        let mrp = parseFloat(vData.mrp || vData.ogPrice || 0);
        if (isNaN(price)) price = 0;
        if (isNaN(mrp)) mrp = 0;

        return {
          vId,
          price,
          mrp,
          stockQty: parseInt(vData.quantity || 0),
          unitValue: vData.unitValue || '',
          unit: vData.pkg || vData.unit || data.unit || '',
          tax: parseFloat(vData.tax || 0)
        };
      });

      // Compute display price coordinates
      let displayPrice = 0;
      let displayMrp = 0;
      if (variants.length > 0) {
        displayPrice = variants[0].price;
        displayMrp = variants[0].mrp;
      } else {
        displayPrice = parseFloat(data.price || data.mrp || 0);
        displayMrp = parseFloat(data.mrp || 0);
      }

      return {
        id: pId,
        name: data.name || 'Unnamed Product',
        cat: mappedCategoryName,
        categoryCode: data.categoryCode,
        price: displayPrice,
        mrp: displayMrp,
        pic: data.pic || '',
        details: data.details || '',
        variants
      };
    });

    setProducts(productList);
  };

  // ==========================================
  // TOTALLING LOGIC
  // ==========================================

  const purchaseTotals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + (item.mrp * item.qty), 0);
    const offerTotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discount = subtotal - offerTotal;
    const tax = cart.reduce((sum, item) => sum + (item.price * item.qty * (item.tax / 100)), 0);
    const grandTotal = offerTotal + tax;

    return {
      subtotal,
      discount,
      tax,
      grandTotal
    };
  }, [cart]);

  const totalQty = useMemo(() => {
    return cart.reduce((qty, item) => qty + item.qty, 0);
  }, [cart]);

  // ==========================================
  // VIEWPORT FILTER (CATALOG SEARCH)
  // ==========================================

  const filteredProducts = useMemo(() => {
    const rawSearch = searchQuery.toLowerCase();
    return products.filter(p => {
      const matchCat = activeCategory === 'All' || p.cat === activeCategory || p.categoryCode === activeCategory;
      const matchSearch = p.name.toLowerCase().includes(rawSearch) || p.cat.toLowerCase().includes(rawSearch);
      
      // If actively searching, bypass active category limits to return matching results globally
      return rawSearch ? matchSearch : (matchCat && matchSearch);
    });
  }, [products, activeCategory, searchQuery]);

  // ==========================================
  // BASKET TRADING EVENTS (CART LOGIC)
  // ==========================================

  const triggerFlyEffect = (event: React.MouseEvent<HTMLElement>, product: Product) => {
    // Optimized for ultimate, lag-free performance on mobile/tablet devices
    // Only animate bouncing cart icon without expensive DOM layout measurement queries
    setCartBouncing(true);
    setTimeout(() => setCartBouncing(false), 150);
  };

  const handleProductSelection = (product: Product, event: React.MouseEvent<HTMLElement>) => {
    if (product.variants && product.variants.length > 1) {
      setSelectedProductForVariant(product);
      setSelectedVariantIndex(0);
    } else {
      const selectedVariant = product.variants[0] || {
        vId: 'default',
        price: product.price,
        mrp: product.mrp,
        unit: 'Pcs',
        unitValue: '1',
        tax: 0
      };

      addToCart({
        id: product.id,
        vId: selectedVariant.vId,
        name: product.name,
        price: selectedVariant.price,
        mrp: selectedVariant.mrp,
        unit: selectedVariant.unit,
        unitValue: selectedVariant.unitValue,
        tax: selectedVariant.tax
      });

      triggerFlyEffect(event, product);
    }
  };

  const addToCart = (item: Omit<CartItem, 'qty'>, changeAmount = 1) => {
    const uniqueKey = `${item.id}_${item.vId}`;
    setCart(prev => {
      const existing = prev.find(i => `${i.id}_${i.vId}` === uniqueKey);
      if (existing) {
        const nextQty = existing.qty + changeAmount;
        if (nextQty <= 0) {
          return prev.filter(i => `${i.id}_${i.vId}` !== uniqueKey);
        }
        return prev.map(i => `${i.id}_${i.vId}` === uniqueKey ? { ...i, qty: nextQty } : i);
      }
      if (changeAmount > 0) {
        addToast(`Added ${item.name} to checkout`, 'success');
        return [...prev, { ...item, qty: changeAmount }];
      }
      return prev;
    });
  };

  const removeItemDirectly = (uniqueKey: string) => {
    setCart(prev => prev.filter(i => `${i.id}_${i.vId}` !== uniqueKey));
    addToast("Removed item", "info");
  };

  const forceClearBasket = () => {
    if (cart.length === 0) return;
    if (confirm("Clear transaction basket and discard active entries?")) {
      setCart([]);
      generateNewOrderId();
      addToast("Active order cleared", "warn");
    }
  };

  // ==========================================
  // TRANSACTION SUSPENSION (HOLD ORDERS)
  // ==========================================

  const holdActiveTransaction = () => {
    if (cart.length === 0) {
      addToast("Cannot hold empty cart", "warn");
      return;
    }

    const nextHeld: HeldOrder = {
      id: orderId,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: [...cart],
      total: purchaseTotals.grandTotal
    };

    setHeldOrders(prev => [...prev, nextHeld]);
    setCart([]);
    generateNewOrderId();
    addToast(`Transaction ${nextHeld.id} suspended`, "info");
  };

  const resumeHeldOrder = (order: HeldOrder) => {
    if (cart.length > 0) {
      if (!confirm("Your current basket is not empty. Load held order and overwrite current lines?")) {
        return;
      }
    }
    setOrderId(order.id);
    setCart(order.items);
    setHeldOrders(prev => prev.filter(o => o.id !== order.id));
    setIsHeldModalOpen(false);
    addToast(`Resumed transaction ${order.id}`, "success");
  };

  // ==========================================
  // CAMERA INTEGRATION (BARCODE SCANS)
  // ==========================================

  const handleDeviceScanSuccess = (rawScannedCode: string) => {
    // Log scanned text to console as implemented in reference terminal.html
    console.log("QR/Barcode Scan Result:", rawScannedCode);
    
    // Display browser alert with scanned details, following exact reference spec
    alert("Scanned: " + rawScannedCode);
    
    // Render feedback toast in application UI
    addToast(`Scan Succeeded: ${rawScannedCode}`, "success");
  };

  // ==========================================
  // PAYMENT PROCESSING & MODAL PORTAL CORES
  // ==========================================

  const launchPaymentReceiptProcessor = () => {
    if (cart.length === 0) return;
    setCashReceived('');
    setCardReferenceNumber('');
    setSelectedPayMethod('Cash');
    setIsPaymentModalOpen(true);
  };

  const selectPaymentStrategy = (method: string) => {
    setSelectedPayMethod(method);
    if (method === 'UPI') {
      triggerUpiQrGenerator();
    }
  };

  const triggerUpiQrGenerator = async () => {
    const upiId = paymentOwnerUpi;
    const name = paymentOwnerName;
    const exactAmount = purchaseTotals.grandTotal.toFixed(2);
    
    // Construct UPI standard deep links
    const link = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&am=${exactAmount}&cu=INR`;

    try {
      const dataUrl = await QRCode.toDataURL(link, {
        width: 250,
        margin: 2,
        color: {
          dark: '#0f172a', // deep slate slate-900
          light: '#ffffff'
        }
      });
      setUpiQrCodeDataUrl(dataUrl);
      
      // Initialize expiration counting
      setUpiTimer(150); // 2:30
      if (upiTimerRef.current) clearInterval(upiTimerRef.current);
      upiTimerRef.current = setInterval(() => {
        setUpiTimer(t => {
          if (t <= 1) {
            clearInterval(upiTimerRef.current);
            return 0;
          }
          return t - 1;
        });
      }, 1000);

    } catch (err) {
      console.error("QR construction error", err);
    }
  };

  const confirmUpiLinkTransition = () => {
    // Trigger receipt print
    generatePrintReceiptDocument();
  };

  // Image upload handles for screen screenshots verified
  const loadScreenshotPreview = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setScreenshotPreview(event.target.result as string);
        setScreenshotFileUploaded(true);
        stopCamera(); // stop camera if user manually uploads a file
      }
    };
    reader.readAsDataURL(file);
  };

  // Camera core actions
  useEffect(() => {
    if (isCameraActive && cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [isCameraActive, cameraStream]);

  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  // Frequently query/request camera permission when upload modal is open and camera state isn't active
  useEffect(() => {
    let intervalId: any = null;

    if (isUploadModalOpen && !cameraStream && !screenshotPreview) {
      // 1. Set up interval to frequently (every 3 seconds) check & auto-request camera permission from the browser
      intervalId = setInterval(() => {
        if (!isCameraActive && !cameraStream && !screenshotPreview) {
          console.log("Auto-requesting camera permission (frequent trigger strategy)...");
          startCamera();
        }
      }, 3000);

      // 2. Clear block automatically when page is refocused (useful if user goes to browser settings, allows and returns)
      const handleFocusRecheck = () => {
        if (!isCameraActive && !cameraStream && !screenshotPreview) {
          console.log("Window focused: immediately retrying camera initiation...");
          startCamera();
        }
      };
      window.addEventListener('focus', handleFocusRecheck);

      return () => {
        if (intervalId) clearInterval(intervalId);
        window.removeEventListener('focus', handleFocusRecheck);
      };
    }
  }, [isUploadModalOpen, isCameraActive, cameraStream, screenshotPreview]);

  const startCamera = async () => {
    setCameraError(null);
    setScreenshotPreview('');
    setScreenshotFileUploaded(false);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setCameraStream(stream);
    } catch (err: any) {
      console.error("Failed to acquire camera:", err);
      setCameraError(err.message || "Failed to launch camera. Please check your permissions or upload a file instead.");
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const takePhotoAction = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setScreenshotPreview(dataUrl);
        setScreenshotFileUploaded(true);
        stopCamera();
      }
    }
  };

  const closeUploadModal = () => {
    stopCamera();
    setIsUploadModalOpen(false);
  };

  const submitPaymentProofEvidence = async () => {
    if (!screenshotPreview) {
      alert("Please capture or upload payment proof before completing the sale.");
      return;
    }
    
    const imageUrl = await uploadUPIpaymentScreenshots(screenshotPreview, storageBUCKET);
    console.log(imageUrl);
    if (!imageUrl) {
      addToast("Failed to upload payment evidence", "warn");
      return;
    }

    closeUploadModal();
    setIsUpiModalOpen(false);
    
    addToast("Payment evidence validated", "success");
    completeTransactionSale(imageUrl);
  };

  const completeTransactionSale = async (imageUrl?: string) => {
    // Save details to activeReceipt first
    const receiptDetails = {
      orderId: orderId,
      cart: [...cart],
      paymentMethod: selectedPayMethod,
      receivedAmount: selectedPayMethod === 'UPI' || selectedPayMethod === 'Card' ? purchaseTotals.grandTotal : parseFloat(cashReceived || '0'),
      changeDue: parsedChangeDue,
      totals: { ...purchaseTotals },
      dateTimeString: new Date().toLocaleString(),
      cardRefNo: selectedPayMethod === 'Card' ? cardReferenceNumber : ""
    };
    
    setActiveReceipt(receiptDetails);

    // Reset checkout forms
    setCart([]);
    setCashReceived('');
    setCardReferenceNumber('');
    generateNewOrderId();
    setIsPaymentModalOpen(false);
    setIsUpiModalOpen(false);
    setIsUploadModalOpen(false);

    // Instant/automated download of high-fidelity PDF receipt right upon checkout settlement
    fallbackTextDownload(receiptDetails);
    
    check();

    await savePayment({
      ...receiptDetails,
      cart: JSON.stringify(receiptDetails.cart),
      imageurl: selectedPayMethod === 'UPI' ? imageUrl : ""
    });

    addToast("Sale recorded successfully! Receipt generated.", "success");
  };

  const generatePrintReceiptDocument = () => {
    // Trigger browser printer pipeline
    setTimeout(() => {
      window.print();
    }, 400);
  };

  const dismissKeyboard = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const downloadReceiptAsFile = async (receiptData?: any) => {
    const data = receiptData || activeReceipt;
    if (!data) return;

    check();

    const element = document.getElementById("interactive-thermal-receipt") || document.getElementById("printable-receipt");
    if (!element) {
      fallbackTextDownload(data);
      return;
    }

    addToast("Generating high-fidelity receipt PDF...", "info");

    html2canvas(element, {
      backgroundColor: "#ffffff", // solid white crisp canvas
      scale: 3, // crisp high definition zoom factor
      useCORS: true,
      logging: false,
      allowTaint: true
    }).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 80; // print receipt standard 80mm width
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [imgWidth, imgHeight] // perfectly fit receipt paper size with zero clipping
      });

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`DAILYNEST_RECEIPT_${data.orderId}.pdf`);
      addToast("Colored PDF receipt downloaded!", "success");
    }).catch((err) => {
      console.error("PDF canvas export failed:", err);
      fallbackTextDownload(data);
    });
  };

  const fallbackTextDownload = (data: any) => {
    // Generate a highly-styled, gorgeous vector PDF receipt directly via jsPDF
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [80, 150 + data.cart.length * 8] // dynamic sizing matching items
    });

    // Outer border
    doc.setDrawColor(229, 224, 216);
    doc.rect(2, 2, 76, 146 + data.cart.length * 8);

    // Set font style
    doc.setFont("courier", "bold");
    
    // Draw signature blue brand header box
    doc.setFillColor(37, 99, 235); // solid vivid blue brand element
    doc.rect(4, 4, 72, 8, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9.5);
    doc.text("DAILYNEST POS", 40, 9.5, { align: "center" });
    
    // Subtext Address Header
    doc.setTextColor(59, 130, 246); // dynamic brand blue accent text
    doc.setFont("courier", "bold");
    doc.setFontSize(7.5);
    doc.text("HIGH SPEED CHECKOUT SYSTEM", 40, 16.5, { align: "center" });
    
    doc.setTextColor(100, 116, 139);
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.text("Aalbot Retail Partners Inc.", 40, 20, { align: "center" });
    doc.text("Trivandrum City Circle, India", 40, 23.5, { align: "center" });
    
    // Dotted separator line
    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(4, 26.5, 76, 26.5);
    
    // Meta descriptions block
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(7.5);
    doc.text(`INVOICE NO : ${data.orderId}`, 4, 31);
    doc.text(`DATE & TIME: ${data.dateTimeString}`, 4, 34.5);
    doc.text(`PAY METHOD : ${data.paymentMethod.toUpperCase()}`, 4, 38);
    doc.text(`REGISTER   : TERM-03D (ONLINE CHECKOUT)`, 4, 41.5);
    
    // Header border line
    doc.line(4, 44.5, 76, 44.5);
    
    // Grid Table columns labels
    doc.setFont("courier", "bold");
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("ITEM DESCRIPTION", 4, 48.5);
    doc.text("QTY", 48, 48.5, { align: "center" });
    doc.text("TOTAL (INR)", 76, 48.5, { align: "right" });
    
    // Solid separator
    doc.setLineDashPattern([], 0);
    doc.setDrawColor(30, 41, 59); // strong outline split
    doc.line(4, 50.5, 76, 50.5);
    
    let y = 54.5;
    doc.setFont("courier", "normal");
    doc.setTextColor(30, 41, 59);
    
    data.cart.forEach((item: any) => {
      let displayName = item.name;
      if (item.variantName) {
        displayName += ` [${item.variantName}]`;
      }
      
      const cleanName = displayName.length > 20 ? displayName.substring(0, 18) + ".." : displayName;
      doc.text(cleanName, 4, y);
      doc.text(item.qty.toString(), 48, y, { align: "center" });
      doc.text(`INR ${(item.qty * item.price).toFixed(2)}`, 76, y, { align: "right" });
      y += 5.5;
    });
    
    // Separator line
    doc.setDrawColor(203, 213, 225);
    doc.line(4, y, 76, y);
    y += 4;
    
    // Financial rows
    doc.setFont("courier", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("GROSS SUBTOTAL:", 4, y);
    doc.text(`INR ${data.totals.subtotal.toFixed(2)}`, 76, y, { align: "right" });
    y += 4.5;
    
    if (data.totals.discount > 0) {
      doc.setTextColor(220, 38, 38); // Red colored savings line
      doc.setFont("courier", "bold");
      doc.text("SAVINGS DISCOUNT:", 4, y);
      doc.text(`-INR ${data.totals.discount.toFixed(2)}`, 76, y, { align: "right" });
      doc.setFont("courier", "normal");
      doc.setTextColor(71, 85, 105);
      y += 4.5;
    }
    
    doc.text("TAX (INCL CGST/SGST):", 4, y);
    doc.text(`INR ${data.totals.tax.toFixed(2)}`, 76, y, { align: "right" });
    y += 5;
    
    // Signature Grand Total Box (Beautiful Colored Rect in PDF)
    doc.setFillColor(239, 246, 255); // light-blue fill highlight identical to interface
    doc.rect(4, y, 72, 7.5, "F");
    doc.setDrawColor(191, 219, 254);
    doc.rect(4, y, 72, 7.5, "S");
    
    doc.setTextColor(30, 58, 138); // rich brand blue text
    doc.setFont("courier", "bold");
    doc.text("NET TOTAL DUE:", 6, y + 4.8);
    doc.text(`INR ${data.totals.grandTotal.toFixed(2)}`, 74, y + 4.8, { align: "right" });
    y += 12;
    
    // Dynamic Settlement Section Container colors
    doc.setFont("courier", "normal");
    if (data.paymentMethod.toUpperCase() === 'CASH') {
      doc.setFillColor(240, 253, 244); // mint-green backdrop
      doc.rect(4, y, 72, 10.5, "F");
      doc.setDrawColor(187, 247, 208);
      doc.rect(4, y, 72, 10.5, "S");
      
      doc.setTextColor(21, 128, 61); // forest green text
      doc.text(`CASH RECEIPT TENDER: INR ${data.receivedAmount.toFixed(2)}`, 6, y + 4);
      doc.setFont("courier", "bold");
      doc.text(`CHANGE RETURN DUE : INR ${data.changeDue.toFixed(2)}`, 6, y + 8);
    } else {
      doc.setFillColor(236, 253, 245); // vibrant green proof verify badge style
      doc.rect(4, y, 72, 6.5, "F");
      doc.setDrawColor(167, 243, 208);
      doc.rect(4, y, 72, 6.5, "S");
      
      doc.setTextColor(6, 95, 70);
      doc.setFont("courier", "bold");
      doc.text("⚡ UPI SECURED PAYMENT VERIFIED", 40, y + 4.2, { align: "center" });
    }
    y += 13.5;
    
    // High contrast structural simulated barcodes
    doc.setDrawColor(30, 30, 30);
    doc.setTextColor(148, 163, 184);
    doc.setLineDashPattern([2, 2.5, 4.5, 1, 3.5, 2, 1, 4.5], 0);
    doc.line(8, y, 72, y);
    doc.line(8, y + 1.2, 72, y + 1.2);
    doc.line(8, y + 2.4, 72, y + 2.4);
    
    doc.setFont("courier", "bold");
    doc.setFontSize(6.5);
    doc.text(`*${data.orderId}*`, 40, y + 5.5, { align: "center" });
    y += 10.5;
    
    // Core receipt greetings and compliance
    doc.setTextColor(30, 27, 75);
    doc.setFontSize(7.5);
    doc.text("THANK YOU FOR YOUR VISIT!", 40, y, { align: "center" });
    
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Please save this digital log paperless index.", 40, y + 3.2, { align: "center" });
    
    doc.text("POS v4.89 • Node TERM-03D", 40, y + 7, { align: "center" });

    // Stream and trigger download in immediate buffer context
    const blobPdf = doc.output("blob");
    const blobUrl = URL.createObjectURL(blobPdf);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `DAILYNEST_RECEIPT_${data.orderId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);

    addToast("High-fidelity PDF receipt downloaded!", "success");
  };

  // State calculations
  const parsedChangeDue = useMemo(() => {
    const received = parseFloat(cashReceived || '0');
    const grand = purchaseTotals.grandTotal;
    return Math.max(0, received - grand);
  }, [cashReceived, purchaseTotals.grandTotal]);

  const removeFlyItem = (id: number) => {
    setFlyingItems(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className={`h-screen max-h-screen overflow-hidden flex flex-col font-sans relative ${isThemeLight ? 'light-theme bg-stone-50 text-stone-900 border-stone-200' : 'bg-slate-950 text-slate-100 border-slate-900'}`}>
      
      {/* Toast Overlay Station */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 shadow-md backdrop-blur-md pointer-events-auto max-w-[280px] sm:max-w-[320px] ${
                toast.type === "success"
                  ? "border-green-500/20 bg-green-950/85 text-green-300"
                  : toast.type === "warn"
                  ? "border-amber-500/20 bg-amber-950/85 text-amber-300"
                  : "border-blue-500/20 bg-blue-950/85 text-blue-300"
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] sm:text-xs font-medium leading-tight">
                {toast.message}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Embedded Printable Receipt Block */}
      {activeReceipt && (
        <ReceiptPrint
          orderId={activeReceipt.orderId}
          cart={activeReceipt.cart}
          paymentMethod={activeReceipt.paymentMethod}
          receivedAmount={activeReceipt.receivedAmount}
          changeDue={activeReceipt.changeDue}
          totals={activeReceipt.totals}
          dateTimeString={activeReceipt.dateTimeString}
          cardRefNo={activeReceipt.cardRefNo}
        />
      )}

      {/* Fly To Cart Animations overlay */}
      {flyingItems.map(item => (
        <motion.div
          key={item.id}
          initial={{ x: item.from.x, y: item.from.y, scale: 1.2, opacity: 1 }}
          animate={{ x: item.to.x, y: item.to.y, scale: 0.15, opacity: 0.2 }}
          transition={{ duration: 0.65, ease: [0.25, 1, 0.5, 1] }}
          onAnimationComplete={() => removeFlyItem(item.id)}
          className="fixed z-50 pointer-events-none rounded-lg border border-blue-500 bg-blue-950/90 p-2 flex items-center justify-center text-lg h-10 w-10 overflow-hidden shadow-lg"
        >
          {item.src ? (
            <img src={item.src} className="h-full w-full object-contain" alt="" />
          ) : (
            item.emoji || "📦"
          )}
        </motion.div>
      ))}

      {/* ==========================================
          NAVBAR HEADER
          ========================================== */}
      <header className={`h-16 shrink-0 border-b flex items-center justify-between px-3 sm:px-6 z-10 sticky top-0 backdrop-blur-md ${isThemeLight ? 'bg-white/85 border-stone-200/80 shadow-xs' : 'bg-slate-900/80 border-slate-800/80'}`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="h-8.5 w-8.5 sm:h-9 sm:w-9 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-lg sm:rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <Receipt className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <h1 className={`font-display text-sm sm:text-base font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r truncate ${
              isThemeLight ? 'from-blue-600 to-indigo-600' : 'from-blue-400 to-indigo-300'
            }`}>
              DAILYNEST POS
            </h1>
            <p className={`text-[10px] hidden sm:block truncate ${isThemeLight ? 'text-stone-500 font-medium' : 'text-slate-400'}`}>Dual Core High Speed Checkout Terminal</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Held suspension order trigger */}
          <button
            onClick={() => setIsHeldModalOpen(true)}
            className={`relative flex h-9 items-center justify-center gap-1.5 rounded-xl border transition-all hover:scale-105 active:scale-95 cursor-pointer px-2.5 sm:px-3.5 text-xs font-semibold ${
              isThemeLight
                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100/70 shadow-xs'
                : 'border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400'
            }`}
            title="Held Lines"
          >
            <Pause className="h-3.5 w-3.5" />
            <span className="hidden md:inline">HELD LINES</span>
            {heldOrders.length > 0 && (
              <span className="flex h-4.5 w-4.5 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-red-500 text-[9px] sm:text-[10px] font-bold text-white shadow shadow-red-500/30 shrink-0">
                {heldOrders.length}
              </span>
            )}
          </button>

          {/* Settings Drawer Trigger */}
          <button
            onClick={() => {
              setIsSettingsOpen(true);
            }}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all hover:scale-105 active:scale-95 cursor-pointer text-xs font-bold ${
              isThemeLight 
                ? 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 hover:text-stone-900 shadow-xs' 
                : 'border-slate-800 bg-slate-900/40 hover:bg-slate-850 text-slate-300 hover:text-white'
            }`}
            title="Open Settings & Transaction History"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Theme switcher */}
          <button
            onClick={() => setIsThemeLight(!isThemeLight)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all active:scale-95 cursor-pointer ${
              isThemeLight 
                ? 'border-stone-200 bg-stone-50 hover:bg-stone-105 text-stone-600 hover:text-stone-900 shadow-xs' 
                : 'border-slate-800 bg-slate-900/40 hover:bg-slate-850 text-slate-400 hover:text-white'
            }`}
            title={isThemeLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
          >
            {isThemeLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          {/* Mobile Cart Floating Badge Button Trigger */}
          <button
            ref={cartTargetRef}
            onClick={() => setIsCartOpenOnMobile(true)}
            className={`flex h-9 w-9 md:hidden items-center justify-center rounded-xl border relative transition-all active:scale-95 cursor-pointer ${
              cartBouncing 
                ? 'scale-110 border-green-550 bg-green-550 text-white shadow-md' 
                : isThemeLight
                ? 'border-stone-200 bg-white text-stone-600 hover:text-stone-900 shadow-xs'
                : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-white'
            }`}
            title="Checkout cart"
          >
            <ShoppingCart className="h-4 w-4" />
            {cart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white shadow-md">
                {cart.reduce((qty, i) => qty + i.qty, 0)}
              </span>
            )}
          </button>

        </div>
      </header>

      {/* ==========================================
          MAIN APPLICATION WORKSPACE
          ========================================== */}
      <main className="flex-1 flex overflow-hidden z-0">
        
        {/* LEFT COLUMN: PRODUCT GRID + CONTROLS (65%) */}
        <section className={`flex-1 md:flex-[0_0_65%] min-w-0 flex flex-col border-r ${
          isThemeLight ? 'border-stone-200/60 bg-stone-50' : 'border-gray-800/40 bg-slate-950'
        }`}>
          
          {/* SEARCH & CODE SCANNER WORK BAR */}
          <div className={`p-4 px-3 sm:px-6 shrink-0 flex items-center gap-3 border-b ${
            isThemeLight ? 'border-stone-200/80 bg-stone-50/50' : 'border-gray-800/30'
          }`}>
            <div className="relative flex-1">
              <Search className="absolute top-1/2 -translate-y-1/2 left-4 h-4.5 w-4.5 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search description, code, or brand..."
                className={`w-full h-11 pl-11 pr-4 rounded-xl border text-sm font-semibold tracking-wide outline-none focus:border-blue-500 transition-colors shadow-inner ${
                  isThemeLight 
                    ? 'border-stone-300 bg-white text-stone-900 placeholder:text-stone-400 focus:shadow-blue-500/10' 
                    : 'border-slate-800 bg-slate-900/40 text-white placeholder:text-gray-500'
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={`absolute top-1/2 -translate-y-1/2 right-4 p-1 rounded-full transition-colors ${
                    isThemeLight ? 'text-stone-400 hover:text-stone-700 hover:bg-stone-200' : 'text-gray-500 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Scanning floating mini hardware trigger button */}
            <button
              onClick={() => setIsScannerOpen(true)}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all shadow hover:scale-105 active:scale-95 cursor-pointer ${
                isThemeLight
                  ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white hover:shadow-blue-500/10'
                  : 'border-blue-500/20 bg-blue-500/10 text-blue-400 hover:text-white hover:bg-blue-500 hover:shadow-blue-500/20'
              }`}
              title="Open Barcode Scanner"
            >
              <Camera className="h-5 w-5" />
            </button>
          </div>

          {/* FILTER ACCORDION (CATEGORY SELECTION RAIL) */}
          <div 
            className={`px-6 h-[48px] border-b shrink-0 flex items-center gap-2 overflow-x-auto select-none no-scrollbar transition-colors ${
              isThemeLight ? 'border-stone-200 bg-stone-100/30' : 'border-gray-800/10'
            }`}
            onScroll={dismissKeyboard}
            onTouchMove={dismissKeyboard}
          >
            <button
              onClick={() => {
                setActiveCategory('All');
                setSearchQuery('');
              }}
              className={`h-7 px-4 rounded-full text-xs font-bold transition-all shrink-0 uppercase tracking-wider border cursor-pointer ${
                activeCategory === 'All'
                  ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20'
                  : isThemeLight
                  ? 'bg-stone-100 text-stone-600 border-stone-200 hover:text-stone-950 hover:bg-stone-200'
                  : 'bg-transparent text-gray-400 border-gray-850 hover:text-white'
              }`}
            >
              All Products
            </button>
            {categories.map((cat) => (
              <button
                key={cat.code}
                onClick={() => {
                  setActiveCategory(cat.name);
                  setSearchQuery('');
                }}
                className={`h-7 px-4 rounded-full text-xs font-bold transition-all shrink-0 uppercase tracking-wider border cursor-pointer ${
                  activeCategory === cat.name || activeCategory === cat.code
                    ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-500/20'
                    : isThemeLight
                    ? 'bg-stone-100 text-stone-600 border-stone-200 hover:text-stone-950 hover:bg-stone-200'
                    : 'bg-transparent text-gray-400 border-gray-850 hover:text-white'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* CATALOG DISPLAY (GRID VIEW) */}
          <div 
            className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 scroll-smooth"
            onScroll={dismissKeyboard}
            onTouchMove={dismissKeyboard}
          >
            {isProductsLoading ? (
               <div className="space-y-6">
                {/* Active fetch feed feedback */}
                <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                  isThemeLight 
                    ? 'bg-blue-50 border-blue-100 text-blue-800 shadow-xs' 
                    : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                }`}>
                  <RefreshCw className={`h-4.5 w-4.5 animate-spin ${isThemeLight ? 'text-blue-600' : 'text-blue-400'}`} />
                  <div className="text-left">
                    <span className={`text-xs font-bold uppercase tracking-widest block ${
                      isThemeLight ? 'text-blue-800' : 'text-blue-400'
                    }`}>Syncing Database Feed...</span>
                    <p className={`text-[10px] mt-0.5 ${isThemeLight ? 'text-blue-700/80' : 'text-gray-400'}`}>Fetching live variant streams & offline backups from Firebase.</p>
                  </div>
                </div>

                {/* Grid skeleton */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1.5 sm:gap-2 pb-12">
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <div key={idx} className={`border rounded-xl p-3 space-y-3 animate-pulse ${
                      isThemeLight ? 'bg-white border-stone-200 shadow-2xs' : 'bg-gray-900/40 border-gray-800/60'
                    }`}>
                      {/* Image placeholder */}
                      <div className={`aspect-square w-full rounded-lg flex items-center justify-center ${
                        isThemeLight ? 'bg-stone-50' : 'bg-gray-800/30'
                      }`}>
                        <RefreshCw className={`h-4 w-4 animate-spin ${isThemeLight ? 'text-stone-300' : 'text-gray-700'}`} />
                      </div>
                      {/* Text strings */}
                      <div className="space-y-2">
                        <div className={`h-3 rounded w-3/4 ${isThemeLight ? 'bg-stone-100' : 'bg-gray-800/80'}`}></div>
                        <div className={`h-2 rounded w-1/2 ${isThemeLight ? 'bg-stone-100' : 'bg-gray-800/50'}`}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
                <FolderOpen className={`h-12 w-12 mb-3 stroke-1 ${isThemeLight ? 'text-stone-300' : 'text-gray-650'}`} />
                <span className={`font-display font-semibold text-base ${isThemeLight ? 'text-stone-700' : 'text-gray-300'}`}>Catalog matching empty</span>
                <p className={`text-xs max-w-xs mt-1 leading-normal ${isThemeLight ? 'text-stone-400' : 'text-gray-500'}`}>Try modifying your search or clean category triggers.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-1.5 sm:gap-2 pb-12">
                {filteredProducts.map((p) => (
                  <div key={p.id} className="contents">
                    <ProductCard
                      product={p}
                      onSelect={handleProductSelection}
                      isThemeLight={isThemeLight}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

        </section>

        {/* RIGHT COLUMN: REASSURING MAIN CART PANEL (35%) (STAYS VISIBLE ON TABLET/DESKTOP) */}
        <section className={`hidden md:flex md:flex-[0_0_35%] min-w-0 flex-col ${
          isThemeLight ? 'bg-stone-100/50 border-l border-stone-200' : 'bg-slate-900/20'
        }`}>
          {renderCheckoutBasket()}
        </section>

      </main>

      {/* ==========================================
          MOBILE SIDE DRAWER COLLAPSIBLE CHECKOUT
          ========================================== */}
      <AnimatePresence>
        {isCartOpenOnMobile && (
          <div className="fixed inset-0 z-40 md:hidden flex justify-end">
            {/* Dark Mask backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpenOnMobile(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            ></motion.div>

            {/* Sliding Panel sheet */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
              className={`relative w-full max-w-md h-full flex flex-col z-10 shadow-2xl transition-colors ${
                isThemeLight ? 'bg-white' : 'bg-gray-950'
              }`}
            >
              {renderCheckoutBasket(() => setIsCartOpenOnMobile(false))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          MODULAR MODALS & FLOATING DIALOG ENGINES
          ========================================== */}

      {/* 1. Barcode/QR Laser Lens Scanner Component */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleDeviceScanSuccess}
      />

      {/* 2. Unit / Pack Variant Selector Modal */}
      <AnimatePresence>
        {selectedProductForVariant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 sm:p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-[550px] max-h-[92vh] rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-colors ${
                isThemeLight ? 'border-stone-200 bg-white' : 'border-gray-800 bg-gray-900'
              }`}
            >
              <div className={`flex items-center justify-between border-b p-4 md:p-5 shrink-0 ${
                isThemeLight ? 'border-stone-150 bg-stone-50/50' : 'border-gray-800'
              }`}>
                <div>
                  <span className={`text-[9px] uppercase font-bold tracking-wider ${
                    isThemeLight ? 'text-stone-400' : 'text-gray-500'
                  }`}>Configure pack unit</span>
                  <h3 className={`font-display text-sm md:text-base font-bold leading-tight ${
                    isThemeLight ? 'text-stone-900' : 'text-white'
                  }`}>{selectedProductForVariant.name}</h3>
                </div>
                <button
                  onClick={() => setSelectedProductForVariant(null)}
                  className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
                    isThemeLight ? 'bg-stone-100 text-stone-500 hover:text-stone-900 hover:bg-stone-200' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Grid content */}
              <div className="p-4 md:p-6 flex flex-col md:flex-row gap-4 md:gap-5 overflow-y-auto no-scrollbar">
                
                {/* Hero side */}
                <div className={`w-full md:w-[150px] shrink-0 flex flex-row md:flex-col items-center justify-center p-3 border rounded-xl h-16 md:h-auto md:aspect-square ${
                  isThemeLight ? 'bg-stone-50/60 border-stone-200' : 'bg-white/5 border-gray-800'
                }`}>
                  {selectedProductForVariant.pic ? (
                    <img src={selectedProductForVariant.pic} className="h-10 md:h-[110px] max-w-full object-contain mix-blend-overlay" alt="" referrerPolicy="referrer" />
                  ) : (
                    <span className="text-2xl md:text-5xl text-gray-700">📦</span>
                  )}
                  <span className={`text-[10px] font-semibold text-stone-500 md:mt-2 ml-3 md:ml-0 md:block hidden ${
                    isThemeLight ? 'text-stone-400' : 'text-gray-500'
                  }`}>Quick Select</span>
                </div>

                {/* Details side */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className={`text-[10px] font-mono uppercase tracking-wider mb-2 ${
                      isThemeLight ? 'text-stone-400' : 'text-gray-450'
                    }`}>Unit Variations</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedProductForVariant.variants.map((v, index) => {
                        const offerPrice = v.price;
                        const mrp = v.mrp;
                        const savingsPct = mrp > offerPrice ? Math.round(((mrp - offerPrice) / mrp) * 100) : 0;
                        return (
                          <div
                            key={v.vId}
                            onClick={() => setSelectedVariantIndex(index)}
                            className={`p-2.5 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between select-none ${
                              selectedVariantIndex === index
                                ? 'bg-blue-500/10 border-blue-500 text-blue-600 font-bold'
                                : isThemeLight
                                ? 'bg-stone-50 border-stone-200 text-stone-600 hover:border-stone-300'
                                : 'bg-transparent border-gray-800 text-gray-400 hover:border-gray-700'
                            }`}
                          >
                            <div>
                              <span className={`text-[11px] font-bold block ${
                                isThemeLight ? 'text-stone-850' : 'text-gray-300'
                              }`}>{v.unitValue} {v.unit}</span>
                              <span className="font-mono text-xs font-black text-green-600 mt-0.5 block">₹{offerPrice}</span>
                            </div>
                            {savingsPct > 0 && (
                              <span className="absolute -top-2 -right-1 rounded bg-blue-600 px-1 py-0.5 text-[7px] font-bold text-white uppercase tracking-wider scale-95">
                                -{savingsPct}%
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary of picked pack */}
                  {selectedProductForVariant.variants[selectedVariantIndex] && (
                    <div className={`mt-4 p-3 rounded-xl border space-y-1 ${
                      isThemeLight ? 'bg-stone-50 border-stone-200' : 'bg-gray-950 border-gray-800'
                    }`}>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-gray-500">Net Pack Weight:</span>
                        <span className={`font-bold uppercase ${
                          isThemeLight ? 'text-stone-850' : 'text-white'
                        }`}>
                          {selectedProductForVariant.variants[selectedVariantIndex].unitValue} {selectedProductForVariant.variants[selectedVariantIndex].unit}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-gray-500">Retail MRP:</span>
                        <span className="font-mono text-gray-450 line-through">₹{selectedProductForVariant.variants[selectedVariantIndex].mrp.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-gray-500">Sales Rate:</span>
                        <span className="font-mono text-sm font-bold text-green-600">₹{selectedProductForVariant.variants[selectedVariantIndex].price.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Add action */}
                  <button
                    onClick={() => {
                      const v = selectedProductForVariant.variants[selectedVariantIndex];
                      addToCart({
                        id: selectedProductForVariant.id,
                        vId: v.vId,
                        name: `${selectedProductForVariant.name} (${v.unitValue} ${v.unit})`,
                        price: v.price,
                        mrp: v.mrp,
                        unit: v.unit,
                        unitValue: v.unitValue,
                        tax: v.tax
                      });
                      setSelectedProductForVariant(null);
                    }}
                    className="mt-4 w-full h-11 shrink-0 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold transition-all shadow shadow-blue-500/20 active:scale-98 cursor-pointer text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" /> Add selected SKU to Invoice
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. Transaction Payment Terminal Gate Modal */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-md my-auto rounded-2xl border p-5 md:p-6 shadow-2xl transition-colors max-h-[94vh] overflow-y-auto no-scrollbar ${
                isThemeLight ? 'border-stone-200 bg-white' : 'border-gray-800 bg-gray-950'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-display text-sm md:text-base font-bold ${isThemeLight ? 'text-stone-900' : 'text-white'}`}>Invoice Settlement Terminal</h3>
                <button
                  onClick={() => setIsPaymentModalOpen(false)}
                  className={`rounded-lg p-1 transition-colors cursor-pointer ${
                    isThemeLight ? 'bg-stone-100 text-stone-500 hover:text-stone-950 hover:bg-stone-200' : 'bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Total display */}
              <div className={`text-center py-6 rounded-2xl border mb-5 relative overflow-hidden ${
                isThemeLight ? 'bg-stone-50 border-stone-200' : 'bg-gray-900 border-gray-800/60'
              }`}>
                <span className="text-[10px] uppercase font-bold tracking-widest text-gray-500">Grand Total Payable</span>
                <h1 className="font-mono text-3xl font-black text-green-600 mt-1">₹{purchaseTotals.grandTotal.toFixed(2)}</h1>
              </div>

              {/* Select payment method */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[
                  { id: 'Cash', icon: <DollarSign className="h-4.5 w-4.5" />, label: 'Cash' },
                  { id: 'Card', icon: <CreditCard className="h-4.5 w-4.5" />, label: 'Card' },
                  { id: 'UPI', icon: <Smartphone className="h-4.5 w-4.5" />, label: 'UPI QR' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectPaymentStrategy(item.id)}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                      selectedPayMethod === item.id
                        ? 'bg-blue-500/10 border-blue-500 text-blue-600 font-bold'
                        : isThemeLight
                        ? 'border-stone-200 text-stone-600 bg-stone-50 hover:bg-stone-100 hover:border-stone-300'
                        : 'border-gray-800 text-gray-400 bg-transparent hover:border-gray-700'
                    }`}
                  >
                    {item.icon}
                    <span className="text-xs">{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Strategy context cash */}
              {selectedPayMethod === 'Cash' && (
                <div className={`p-4 rounded-xl border mb-6 space-y-4 ${
                  isThemeLight ? 'bg-stone-50 border-stone-200' : 'bg-gray-900 border-gray-800/80'
                }`}>
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-wider">Amount Tendered</label>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="₹0.00"
                      className={`w-[140px] px-3 py-1.5 rounded-lg border text-right font-mono text-sm font-bold focus:border-blue-500 outline-none ${
                        isThemeLight ? 'border-stone-300 bg-white text-stone-900' : 'border-gray-800 bg-gray-950 text-white'
                      }`}
                    />
                  </div>
                  <div className={`flex justify-between items-center pt-3 border-t border-dashed ${
                    isThemeLight ? 'border-stone-200' : 'border-gray-850'
                  }`}>
                    <span className="text-xs text-gray-550 font-bold uppercase tracking-wider">Returned Change</span>
                    <span className="font-mono text-base font-bold text-amber-500">₹{parsedChangeDue.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Strategy context Card */}
              {selectedPayMethod === 'Card' && (
                <div className={`p-4 rounded-xl border mb-6 space-y-3 ${
                  isThemeLight ? 'bg-stone-50 border-stone-200' : 'bg-gray-900 border-gray-800/80'
                }`}>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-gray-550 dark:text-gray-400 font-bold uppercase tracking-wider">Card Transaction Reference Number</label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={cardReferenceNumber}
                        onChange={(e) => setCardReferenceNumber(e.target.value)}
                        placeholder="Enter reference number (e.g. 981249)"
                        className={`w-full pl-9 pr-3 py-2 rounded-xl border font-mono text-xs font-bold focus:border-blue-500 outline-none transition-colors ${
                          isThemeLight ? 'border-stone-250 bg-white text-stone-900' : 'border-gray-800 bg-gray-950 text-white'
                        }`}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 font-medium select-none">
                      Enter the terminal print reference number to unlock confirmation settlement.
                    </span>
                  </div>
                </div>
              )}

              {/* Action */}
              {selectedPayMethod === 'UPI' ? (
                <button
                  onClick={() => {
                    setIsPaymentModalOpen(false);
                    setIsUpiModalOpen(true);
                  }}
                  className="w-full h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold transition-all shadow hover:scale-103 active:scale-98 cursor-pointer flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                >
                  <Smartphone className="h-4.5 w-4.5" /> Present Dynamic UPI QR
                </button>
              ) : selectedPayMethod === 'Card' ? (
                cardReferenceNumber.trim() ? (
                  <button
                    onClick={completeTransactionSale}
                    className="w-full h-12 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold transition-all shadow shadow-green-500/20 hover:scale-103 active:scale-98 cursor-pointer flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                  >
                    <CheckCircle2 className="h-4.5 w-4.5" /> Confirm Settlement & Print Receipt
                  </button>
                ) : (
                  <div className={`p-3.5 rounded-xl border border-dashed text-center text-[11px] font-bold tracking-wide transition-all ${
                    isThemeLight 
                      ? 'border-amber-250 bg-amber-50/60 text-amber-700' 
                      : 'border-amber-900/40 bg-amber-950/20 text-amber-500'
                  }`}>
                    ⚠️ Please enter Card transaction reference number to confirm sale
                  </div>
                )
              ) : parseFloat(cashReceived || '0') >= purchaseTotals.grandTotal ? (
                <button
                  onClick={completeTransactionSale}
                  className="w-full h-12 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold transition-all shadow shadow-green-500/20 hover:scale-103 active:scale-98 cursor-pointer flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                >
                  <CheckCircle2 className="h-4.5 w-4.5" /> Confirm Settlement & Print Receipt
                </button>
              ) : (
                <div className={`p-3.5 rounded-xl border border-dashed text-center text-[11px] font-bold tracking-wide transition-all ${
                  isThemeLight 
                    ? 'border-amber-250 bg-amber-50/60 text-amber-700' 
                    : 'border-amber-900/40 bg-amber-950/20 text-amber-500'
                }`}>
                  ⚠️ Amount tendered must be equal to or greater than the total of ₹{purchaseTotals.grandTotal.toFixed(2)}
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. Live UPI QR Code Interactive Gate Modal */}
      <AnimatePresence>
        {isUpiModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-sm my-auto rounded-2xl border p-5 md:p-6 shadow-2xl transition-colors max-h-[94vh] overflow-y-auto no-scrollbar ${
                isThemeLight ? 'border-stone-200 bg-white text-stone-900' : 'border-gray-800 bg-gray-950 text-slate-100'
              }`}
            >
              
              <div className={`flex justify-between items-center border-b pb-3 mb-4 ${
                isThemeLight ? 'border-stone-100' : 'border-gray-800'
              }`}>
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  isThemeLight ? 'text-stone-400' : 'text-gray-500'
                }`}>Secure QR Billing Gateway</span>
                <button
                  onClick={() => setIsUpiModalOpen(false)}
                  className={`rounded-full p-1 cursor-pointer transition-colors ${
                    isThemeLight ? 'bg-stone-100 hover:bg-stone-200 text-stone-500' : 'bg-gray-800 hover:bg-gray-750 text-slate-400 hover:text-white'
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Amount payable */}
              <div className="text-center pt-2">
                <span className={`text-[10px] uppercase font-semibold tracking-wide ${isThemeLight ? 'text-stone-400' : 'text-gray-500'}`}>Total Purchase Value</span>
                <h1 className={`font-mono text-3xl font-black mt-0.5 ${
                  isThemeLight ? 'text-stone-900' : 'text-white'
                }`}>₹{purchaseTotals.grandTotal.toFixed(2)}</h1>
              </div>

              {/* QR Image Holder - kept clean white for maximum scanner contrast & responsiveness */}
              <div className="my-5 flex flex-col items-center justify-center relative bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
                {upiQrCodeDataUrl ? (
                  <img src={upiQrCodeDataUrl} className="h-48 w-48 object-contain rounded" alt="UPI Scan QR" />
                ) : (
                  <div className="h-48 w-48 flex items-center justify-center text-slate-400 uppercase tracking-widest text-[9px] font-mono">Generating dynamic code...</div>
                )}
                
                <p className="text-[10px] text-stone-500 mt-3 text-center leading-normal">Scan this dynamically generated UPI code with Google Pay, PhonePe, Bhim, or Paytm.</p>
              </div>

              {/* Expiry countdown label */}
              <div className="my-3 text-center">
                <span className={`text-[10px] uppercase block font-semibold ${isThemeLight ? 'text-stone-400' : 'text-gray-500'}`}>Payment session expires in</span>
                <span className={`font-mono text-sm font-bold block ${
                  upiTimer <= 30 
                    ? 'text-rose-500 animate-pulse' 
                    : isThemeLight
                    ? 'text-stone-700'
                    : 'text-gray-300'
                }`}>
                  {Math.floor(upiTimer / 60).toString().padStart(2, '0')}:{(upiTimer % 60).toString().padStart(2, '0')}
                </span>
              </div>

              {/* Actions Grid container */}
              <div className={`pt-3 border-t flex flex-col gap-2 ${isThemeLight ? 'border-stone-100' : 'border-gray-800'}`}>
                <button
                  onClick={() => {
                    // Open secondary image-screenshot uploading dialog screen and immediately trigger camera access
                    setIsUploadModalOpen(true);
                    startCamera();
                  }}
                  className={`w-full h-11 rounded-xl font-bold transition-all text-xs uppercase tracking-wider select-none flex items-center justify-center gap-2 cursor-pointer shadow ${
                    isThemeLight ? 'bg-stone-900 hover:bg-stone-850 text-white' : 'bg-slate-850 hover:bg-slate-750 text-slate-200 border border-slate-750/50'
                  }`}
                >
                  <Camera className="h-4 w-4 text-emerald-400" /> Open Camera & Take Photo
                </button>
                <button
                  onClick={confirmUpiLinkTransition}
                  className={`w-full h-11 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all ${
                    isThemeLight 
                      ? 'bg-stone-100 hover:bg-stone-200 text-stone-850' 
                      : 'bg-gray-900 hover:bg-gray-800 text-gray-300'
                  }`}
                >
                  Print QR code receipt
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. UPI Screenshot Evidence Proof Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center  backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-sm my-auto rounded-2xl border p-5 md:p-6 shadow-2xl transition-colors max-h-[94vh] overflow-y-auto no-scrollbar ${
                isThemeLight ? 'border-stone-200 bg-white' : 'border-gray-800 bg-gray-950'
              }`}
            >
              
              <div className={`flex justify-between items-center mb-5 border-b pb-3 ${
                isThemeLight ? 'border-stone-200' : 'border-gray-800'
              }`}>
                <h3 className={`font-display text-sm font-bold uppercase tracking-wider ${
                  isThemeLight ? 'text-stone-900' : 'text-white'
                }`}>Validate payment proof</h3>
                <button
                  onClick={closeUploadModal}
                  className={`rounded-lg p-1 cursor-pointer transition-colors ${
                    isThemeLight ? 'bg-stone-100 text-stone-500 hover:text-stone-950 hover:bg-stone-200' : 'bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-4">
                <p className={`text-xs leading-normal ${isThemeLight ? 'text-stone-500' : 'text-gray-400'}`}>
                  Capture or upload the payment receipt matching the transaction reference of <span className="font-mono font-bold text-green-600">₹{purchaseTotals.grandTotal.toFixed(2)}</span>.
                </p>

                {/* Main Camera / Viewfinder / Preview block */}
                <div className={`relative border border-stone-200 dark:border-gray-800 rounded-2xl overflow-hidden bg-black flex flex-col items-center justify-center min-h-[220px] transition-all`}>
                  {isCameraActive ? (
                    <div className="relative w-full h-[240px] flex items-center justify-center">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      {/* Grid overlays for professional viewfinder aesthetic */}
                      <div className="absolute inset-4 border border-white/20 pointer-events-none rounded-lg flex items-center justify-center flex-col">
                        <div className="w-8 h-8 border-t-2 border-l-2 border-green-500 absolute top-0 left-0"></div>
                        <div className="w-8 h-8 border-t-2 border-r-2 border-green-500 absolute top-0 right-0"></div>
                        <div className="w-8 h-8 border-b-2 border-l-2 border-green-500 absolute bottom-0 left-0"></div>
                        <div className="w-8 h-8 border-b-2 border-r-2 border-green-500 absolute bottom-0 right-0"></div>
                      </div>
                    </div>
                  ) : screenshotPreview ? (
                    <div className="relative w-full p-2 flex flex-col items-center justify-center bg-stone-900/40">
                      <img src={screenshotPreview} className="max-h-[200px] max-w-full object-contain rounded-lg shadow-md border border-stone-300 dark:border-gray-700" alt="Captured Evidence" referrerPolicy="referrer" />
                    </div>
                  ) : (
                    <div className="p-5 text-center flex flex-col items-center justify-center">
                      <div className="p-3 bg-rose-500/15 rounded-full mb-2.5 relative">
                        <Camera className="h-8 w-8 text-rose-500 animate-pulse" />
                        <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                        </span>
                      </div>
                      <span className={`text-xs font-bold block ${isThemeLight ? 'text-stone-800' : 'text-gray-200'}`}>Camera Access Requested</span>
                      
                      {cameraError ? (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-left w-full max-w-xs mx-auto">
                          <p className="text-[10px] text-rose-400 font-medium leading-normal">{cameraError}</p>
                          <div className={`mt-2 text-[9.5px] space-y-1 border-t pt-2 ${isThemeLight ? 'border-rose-550/10 text-stone-600' : 'border-rose-500/10 text-stone-300'}`}>
                            <p className="font-extrabold text-rose-400 uppercase tracking-wider text-[8px]">Safari / Chrome Quick Fix:</p>
                            <p>1. Tap the <span className="font-semibold">Lock or Settings icon URL bar</span> (🔒 / 🛠️).</p>
                            <p>2. Toggle Camera settings to <span className="font-semibold text-emerald-500">"Allow"</span>.</p>
                            <p>3. Tap "Open Camera" below or back to the tab to instantly reload.</p>
                          </div>
                        </div>
                      ) : (
                        <p className={`text-[10px] mt-1.5 leading-normal max-w-[240px] ${isThemeLight ? 'text-stone-500 font-medium' : 'text-gray-400'}`}>
                          Allow camera permissions in your browser to inspect or take proof screenshots instantly.
                        </p>
                      )}
                      
                      <div className="mt-3.5 flex items-center justify-center gap-1.5 text-[9.5px] font-bold text-amber-500/90 dark:text-amber-400">
                        <span className="inline-block animate-spin">⏳</span>
                        <span>Frequently querying camera access every 3 seconds...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Control Toggles inside Modal */}
                <div className="grid grid-cols-2 gap-2">
                  {isCameraActive ? (
                    <button
                      onClick={takePhotoAction}
                      className="col-span-2 h-11 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-green-500/20 active:scale-95"
                    >
                      <Camera className="h-4 w-4" /> Take Photo
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={startCamera}
                        className={`h-10 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isThemeLight ? 'bg-stone-900 hover:bg-stone-850 text-white' : 'bg-slate-850 hover:bg-slate-750 text-slate-100'
                        }`}
                      >
                        <Camera className="h-4 w-4 text-emerald-400" /> 
                        <span>{screenshotPreview ? 'Retake Photo' : 'Open Camera'}</span>
                      </button>

                      <div className="relative h-10">
                        <button
                          className={`w-full h-full rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                            isThemeLight 
                              ? 'bg-white hover:bg-stone-50 border-stone-250 text-stone-800' 
                              : 'bg-gray-900 hover:bg-gray-800 border-gray-800 text-slate-300'
                          }`}
                        >
                          <Upload className="h-4 w-4 text-blue-400" /> 
                          <span>Upload File</span>
                        </button>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={loadScreenshotPreview}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          title="Upload image manually"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Submit Payment proof details trigger button */}
                {!isCameraActive && (
                  <button
                    onClick={submitPaymentProofEvidence}
                    disabled={!screenshotFileUploaded}
                    className={`w-full h-11 rounded-xl text-xs uppercase tracking-wider font-extrabold flex items-center justify-center gap-2 ${
                      screenshotFileUploaded 
                        ? 'bg-gradient-to-tr from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow shadow-green-500/20 active:scale-98 cursor-pointer' 
                        : isThemeLight
                        ? 'bg-stone-100 text-stone-400 border border-stone-200/60 cursor-not-allowed'
                        : 'bg-gray-850 text-gray-500 border border-gray-800/60 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Submit Payment Evidence
                  </button>
                )}
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. Suspended Held Orders List Slider Modal */}
      <AnimatePresence>
        {isHeldModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-md my-auto rounded-2xl border p-5 md:p-6 shadow-2xl transition-colors max-h-[94vh] overflow-y-auto no-scrollbar ${
                isThemeLight ? 'bg-white border-stone-200' : 'bg-gray-900 border-gray-800'
              }`}
            >
              
              <div className={`flex items-center justify-between border-b pb-3 mb-5 ${
                isThemeLight ? 'border-stone-200' : 'border-gray-800'
              }`}>
                <h3 className={`font-display text-base font-bold ${isThemeLight ? 'text-stone-900' : 'text-white'}`}>Suspended Invoices (Held Lines)</h3>
                <button
                  onClick={() => setIsHeldModalOpen(false)}
                  className={`rounded-lg p-1 transition-colors cursor-pointer ${
                    isThemeLight ? 'bg-stone-100 text-stone-500 hover:text-stone-950' : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Lists */}
              <div className="max-h-[300px] overflow-y-auto space-y-2 mb-6">
                {heldOrders.length === 0 ? (
                  <div className={`text-center py-12 text-xs ${isThemeLight ? 'text-stone-400' : 'text-gray-500'}`}>No transactions currently suspended.</div>
                ) : (
                  heldOrders.map((order) => (
                    <div
                      key={order.id}
                      className={`p-3.5 rounded-xl border flex justify-between items-center transition-all hover:translate-x-1 ${
                        isThemeLight
                          ? 'border-stone-200 bg-stone-50 hover:border-stone-300'
                          : 'border-gray-800 bg-gray-950 hover:border-gray-700'
                      }`}
                    >
                      <div>
                        <span className={`font-mono text-sm font-black ${isThemeLight ? 'text-stone-800' : 'text-gray-100'}`}>{order.id}</span>
                        <div className={`text-[10px] mt-1 ${isThemeLight ? 'text-stone-400' : 'text-gray-500'}`}>
                          {order.items.length} units • Suspended at {order.time}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-black text-green-600">₹{order.total.toFixed(2)}</span>
                        <button
                          onClick={() => resumeHeldOrder(order)}
                          className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold text-[11px] uppercase tracking-wider cursor-pointer"
                        >
                          Resume
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => setIsHeldModalOpen(false)}
                className={`w-full h-11 rounded-xl border font-bold text-xs uppercase tracking-wider cursor-pointer transition-all ${
                  isThemeLight 
                    ? 'border-stone-300 bg-transparent text-stone-500 hover:text-stone-850 hover:bg-stone-50' 
                    : 'border-gray-800 bg-transparent text-gray-400 hover:text-white hover:bg-gray-850'
                }`}
              >
                Close Shelf Window
              </button>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          7. LEFT CONTROL PANEL / SETTINGS / HISTORY DRAWER
          ========================================== */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-40 flex justify-start">
            {/* Dark Mask backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsSettingsOpen(false);
                setSelectedHistoryItem(null);
              }}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
            ></motion.div>

            {/* Sliding Panel sheet */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
              className={`relative w-full max-w-md h-full flex flex-col z-10 shadow-2xl transition-colors border-r ${
                isThemeLight ? 'bg-stone-50 border-stone-200 text-stone-900' : 'bg-slate-950 border-slate-900 text-slate-100'
              }`}
            >
              {/* Drawer Header */}
              <div className={`p-4 px-6 border-b flex items-center justify-between shrink-0 ${
                isThemeLight ? 'border-stone-200 bg-white' : 'border-slate-900 bg-slate-900/40'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl border ${
                    isThemeLight ? 'bg-stone-50 border-stone-200 text-blue-600' : 'bg-slate-900 border-slate-800 text-blue-400'
                  }`}>
                    <SlidersHorizontal className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold tracking-tight">Terminal Control</h2>
                    <p className="text-[10px] text-gray-500 font-medium">Database Node: prat-16d46</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setSelectedHistoryItem(null);
                  }}
                  className={`p-1.5 rounded-lg border transition-all active:scale-90 cursor-pointer ${
                    isThemeLight 
                      ? 'border-stone-200 hover:bg-stone-100 text-stone-500 hover:text-stone-800' 
                      : 'border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white'
                  }`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Tabs inside Left column */}
              <div className={`flex p-1.5 mx-4 mt-4 rounded-xl border shrink-0 ${
                isThemeLight ? 'bg-stone-100 border-stone-200' : 'bg-slate-900 border-slate-850'
              }`}>
                <button
                  onClick={() => {
                    setActiveTab('history');
                  }}
                  className={`flex-1 py-1 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'history'
                      ? isThemeLight
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'bg-slate-950 text-white shadow-md shadow-slate-900/30'
                      : 'text-gray-400 hover:text-gray-500'
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  <span>Payments History</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('receiver');
                  }}
                  className={`flex-1 py-1 px-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'receiver'
                      ? isThemeLight
                        ? 'bg-white text-stone-900 shadow-sm'
                        : 'bg-slate-950 text-white shadow-md shadow-slate-900/30'
                      : 'text-gray-400 hover:text-gray-500'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Payment Receiver</span>
                </button>
              </div>

              {/* Panel Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 min-h-0 no-scrollbar">
                {activeTab === 'history' && (
                  <>
                    {/* Selected Item detailed view overlay in drawer */}
                    {selectedHistoryItem ? (
                      <div className="space-y-4">
                        {/* Back action */}
                        <button
                          onClick={() => setSelectedHistoryItem(null)}
                          className={`flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer ${
                            isThemeLight ? 'text-blue-600 hover:text-blue-700' : 'text-blue-400 hover:text-blue-300'
                          }`}
                        >
                          <ChevronRight className="h-4 w-4 rotate-180" />
                          <span>Back to Receipts</span>
                        </button>

                        <div className={`p-4 rounded-xl border ${
                          isThemeLight ? 'bg-white border-stone-200 shadow-xs' : 'bg-slate-900/10 border-slate-800 shadow-2xl'
                        }`}>
                          <div className="flex items-center justify-between mb-4 pb-2 border-b border-dashed border-stone-150 dark:border-slate-800">
                            <div>
                              <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 dark:text-gray-500">Receipt Details</span>
                              <h3 className="text-sm font-mono font-black text-rose-500">#{selectedHistoryItem.orderId || "N/A"}</h3>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              selectedHistoryItem.paymentMethod === 'Cash'
                                ? 'bg-green-500/10 text-green-500'
                                : selectedHistoryItem.paymentMethod === 'Card'
                                ? 'bg-indigo-500/10 text-indigo-500'
                                : 'bg-blue-500/10 text-blue-500'
                            }`}>
                              {selectedHistoryItem.paymentMethod}
                            </span>
                          </div>

                          {/* Purchase totals detail list */}
                          <div className="space-y-2.5 text-xs font-mono">
                            <div className="flex justify-between items-center text-[11px] border-b border-stone-100 dark:border-slate-900 pb-1.5">
                              <span className="text-gray-400">Date/Time</span>
                              <span className="font-bold text-right">{selectedHistoryItem.dateTimeString}</span>
                            </div>
                            {selectedHistoryItem.cardRefNo && (
                              <div className="flex justify-between items-center text-[11px] border-b border-stone-100 dark:border-slate-900 pb-1.5">
                                <span className="text-gray-400">Card Reference No</span>
                                <span className="font-bold text-indigo-500">{selectedHistoryItem.cardRefNo}</span>
                              </div>
                            )}
                            {selectedHistoryItem.imageurl && (
                              <div className="space-y-2 pt-1 pb-1">
                                <span className="text-gray-400 text-[11px] block">UPI Proof Screenshot</span>
                                <div className="border border-stone-200 dark:border-slate-800 rounded-lg overflow-hidden max-h-48 flex justify-center bg-stone-100 dark:bg-slate-900 relative group">
                                  <img 
                                    src={selectedHistoryItem.imageurl} 
                                    alt="UPI payments screen proof" 
                                    className="object-contain max-h-48"
                                    referrerPolicy="no-referrer"
                                  />
                                  <a 
                                    href={selectedHistoryItem.imageurl} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-black text-white text-[10px] font-bold"
                                  >
                                    View full size
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* Item breakdowns parsing */}
                            {(() => {
                              let cartItems: any[] = [];
                              try {
                                if (selectedHistoryItem.cart) {
                                  cartItems = typeof selectedHistoryItem.cart === 'string' 
                                    ? JSON.parse(selectedHistoryItem.cart) 
                                    : selectedHistoryItem.cart;
                                }
                              } catch (e) {
                                console.error("Error parsing cart in history layout:", e);
                              }

                              if (cartItems.length === 0) return null;

                              return (
                                <div className="mt-3 pt-3 border-t border-dashed border-stone-200 dark:border-slate-800 space-y-2">
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block mb-1">Purchased Products ({cartItems.length})</span>
                                  {cartItems.map((item: any, i: number) => (
                                    <div key={i} className="flex justify-between text-[11px] font-sans">
                                      <div className="min-w-0 flex-1 pr-2">
                                        <div className="font-bold truncate text-xs">{item.name}</div>
                                        <div className="text-[10px] text-gray-505 dark:text-gray-400">₹{item.price.toFixed(2)} × {item.qty}</div>
                                      </div>
                                      <span className="font-mono font-semibold shrink-0">₹{(item.price * item.qty).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()}

                            {/* Subtotal, discounts and tax summary */}
                            <div className="mt-4 pt-3 border-t border-stone-200 dark:border-slate-800 space-y-1.5 text-xs">
                              {selectedHistoryItem.totals && (
                                <>
                                  <div className="flex justify-between text-[11px] text-gray-400">
                                    <span>Subtotal:</span>
                                    <span>₹{(selectedHistoryItem.totals.subtotal || 0).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px] text-red-500">
                                    <span>Discount:</span>
                                    <span>-₹{(selectedHistoryItem.totals.discount || 0).toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-[11px] text-gray-400">
                                    <span>GST/Tax:</span>
                                    <span>₹{(selectedHistoryItem.totals.taxAmount || 0).toFixed(2)}</span>
                                  </div>
                                </>
                              )}
                              <div className="flex justify-between text-base font-black text-blue-500 border-t border-dashed border-stone-200 dark:border-slate-800 pt-1.5">
                                <span>Grand Total:</span>
                                <span>₹{(selectedHistoryItem.totals?.grandTotal || selectedHistoryItem.receivedAmount || 0).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action re-print */}
                        <div className="flex gap-2 shrink-0 pt-2">
                          <button
                            onClick={() => {
                              // We can override activeReceipt state to display this inside the live POS receipt output
                              let loadedCartItems = [];
                              try {
                                if (selectedHistoryItem.cart) {
                                  loadedCartItems = typeof selectedHistoryItem.cart === 'string' 
                                    ? JSON.parse(selectedHistoryItem.cart) 
                                    : selectedHistoryItem.cart;
                                }
                              } catch (err) {
                                console.error(err);
                              }

                              const fullReceiptData = {
                                orderId: selectedHistoryItem.orderId,
                                cart: loadedCartItems,
                                paymentMethod: selectedHistoryItem.paymentMethod,
                                receivedAmount: parseFloat(selectedHistoryItem.receivedAmount || '0') || selectedHistoryItem.totals?.grandTotal || 0,
                                changeDue: selectedHistoryItem.changeDue || 0,
                                totals: selectedHistoryItem.totals || {
                                  subtotal: selectedHistoryItem.receivedAmount || 0,
                                  discount: 0,
                                  taxAmount: 0,
                                  grandTotal: selectedHistoryItem.receivedAmount || 0
                                },
                                dateTimeString: selectedHistoryItem.dateTimeString,
                                cardRefNo: selectedHistoryItem.cardRefNo || undefined
                              };
                              setActiveReceipt(fullReceiptData);
                              addToast("Loaded transaction receipt onto main viewport!", "info");
                            }}
                            className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl text-white text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95"
                          >
                            <Printer className="h-4 w-4" /> Load Receipt to Main POS
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* History list */
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-blue-500" />
                            <span>Recent Receipts ({historyPayments.length})</span>
                          </h3>
                        </div>

                        {isHistoryLoading ? (
                          <div className="py-12 text-center text-xs space-y-2 text-gray-400">
                            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                            <p className="font-semibold">Querying live payments from db (prat-16d46)...</p>
                          </div>
                        ) : historyPayments.length === 0 ? (
                          <div className="py-12 text-center border border-dashed border-stone-200 dark:border-slate-800 rounded-2xl p-6 text-xs text-gray-400">
                            No receipts found on database 'prat-16d46'. Settle a checkout transaction to store new records.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {historyPayments.map((payment) => (
                              <div
                                key={payment.id}
                                onClick={() => setSelectedHistoryItem(payment)}
                                className={`p-3.5 rounded-xl border transition-all hover:translate-x-1 cursor-pointer flex flex-col justify-between gap-1 shadow-xs hover:shadow-md ${
                                  isThemeLight 
                                    ? 'bg-white border-stone-200 hover:border-blue-300' 
                                    : 'bg-slate-900 border-slate-900/60 hover:border-slate-800'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-mono text-xs font-bold text-gray-400 dark:text-gray-500">#{payment.orderId || "XML_POS_ID"}</span>
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                                    payment.paymentMethod === 'Cash'
                                      ? 'bg-green-500/10 text-green-500'
                                      : payment.paymentMethod === 'Card'
                                      ? 'bg-indigo-500/10 text-indigo-500'
                                      : 'bg-blue-500/10 text-blue-500'
                                  }`}>
                                    {payment.paymentMethod}
                                  </span>
                                </div>

                                <div className="flex justify-between items-end mt-1">
                                  <div>
                                    <div className="text-[10px] text-gray-400 flex items-center gap-1 font-sans">
                                      <Calendar className="h-3 w-3 shrink-0" />
                                      <span>{payment.dateTimeString || "Recent"}</span>
                                    </div>
                                    {payment.cardRefNo && (
                                      <div className="text-[9px] text-indigo-400 font-mono mt-0.5">Ref: {payment.cardRefNo}</div>
                                    )}
                                  </div>
                                  <div className="text-sm font-black text-blue-500 font-mono text-right">
                                    ₹{(payment.totals?.grandTotal || payment.receivedAmount || 0).toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'receiver' && (
                  <div className="space-y-4">
                    {/* Active profile review card */}
                    <div className={`p-4 rounded-xl border relative overflow-hidden ${
                      isThemeLight ? 'bg-white border-stone-150 shadow-xs' : 'bg-slate-900/40 border-slate-850'
                    }`}>
                      <div className="absolute top-0 right-0 p-3 opacity-[0.04] dark:opacity-[0.06] pointer-events-none">
                        <User className="h-20 w-20" />
                      </div>
                      <h3 className="text-xs font-bold uppercase tracking-wider mb-3.5 flex items-center gap-1.5 text-blue-500">
                        <User className="h-4 w-4" />
                        <span>Active Receiver Profile</span>
                      </h3>
                      
                      <div className="space-y-3 text-xs">
                        <div>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 block uppercase font-bold tracking-wider">Business Name</span>
                          <span className="font-extrabold text-sm tracking-tight">{paymentOwnerName}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 block uppercase font-bold tracking-wider">UPI ID Address</span>
                          <span className="font-mono text-xs font-black text-rose-500 bg-rose-500/5 dark:bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/10 inline-block mt-0.5">{paymentOwnerUpi}</span>
                        </div>
                      </div>
                    </div>

                    {/* Edit Form Card */}
                    <div className={`p-4 rounded-xl border ${
                      isThemeLight ? 'bg-white border-stone-150 shadow-xs' : 'bg-slate-900/40 border-slate-850'
                    }`}>
                      <h3 className="text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-1.5 text-indigo-500">
                        <SlidersHorizontal className="h-4 w-4" />
                        <span>Edit Receiver Settings</span>
                      </h3>

                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 block mb-1 tracking-wider">Business / Owner Name</label>
                          <input
                            type="text"
                            value={editOwnerName}
                            onChange={(e) => setEditOwnerName(e.target.value)}
                            placeholder="e.g. Adhil Business Limited"
                            className={`w-full px-3 py-2 rounded-xl border text-xs font-bold transition-all focus:ring-2 focus:ring-blue-500 outline-none ${
                              isThemeLight 
                                ? 'bg-stone-50 border-stone-200 text-stone-900 focus:bg-white' 
                                : 'bg-slate-950 border-slate-800 text-white focus:bg-slate-900'
                            }`}
                          />
                        </div>

                        <div>
                          <label className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 block mb-1 tracking-wider">UPI Address ID</label>
                          <input
                            type="text"
                            value={editOwnerUpi}
                            onChange={(e) => setEditOwnerUpi(e.target.value)}
                            placeholder="e.g. hafizhamsa015@oksbi"
                            className={`w-full px-3 py-2 rounded-xl border text-xs font-mono transition-all focus:ring-2 focus:ring-blue-550 outline-none ${
                              isThemeLight 
                                ? 'bg-stone-50 border-stone-200 text-stone-900 focus:bg-white' 
                                : 'bg-slate-950 border-slate-800 text-white focus:bg-slate-900'
                            }`}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (!editOwnerName.trim()) {
                              addToast("Owner name cannot be empty", "warn");
                              return;
                            }
                            if (!editOwnerUpi.trim()) {
                              addToast("UPI ID cannot be empty", "warn");
                              return;
                            }
                            setIsSaveConfirmOpen(true);
                          }}
                          className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-xs text-white font-bold tracking-widest uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
                        >
                          <CheckCircle2 className="h-4 w-4" /> Save Receiver Config
                        </button>
                      </div>
                    </div>

                    {/* Metadata notice block */}
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed font-sans border-t border-stone-200 dark:border-slate-900 pt-3 text-center">
                      Updates saved here are stored directly on the <span className="font-semibold text-rose-500 font-mono">paymentowner</span> collection at cluster <span className="font-semibold">'prat-16d46'</span>.
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Sticky Bottom checkout bar */}
      <div className="md:hidden fixed bottom-4 left-4 right-4 z-30 pointer-events-none">
        {cart.length > 0 && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="pointer-events-auto flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-800 shadow-xl"
          >
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Active Cart ({totalQty})</span>
              <span className="font-mono text-base font-black text-green-400">₹{purchaseTotals.grandTotal.toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsCartOpenOnMobile(true)}
                className="px-3.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs text-white font-bold tracking-wide cursor-pointer"
              >
                View Cart
              </button>
              <button
                onClick={launchPaymentReceiptProcessor}
                className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 font-bold text-xs text-white uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                Settle
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ==========================================
          8. RETRO INTERACTIVE THERMAL RECEIPT MODAL
          ========================================== */}
      <AnimatePresence>
        {activeReceipt && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 180 }}
              className="relative w-full max-w-sm my-2 sm:my-8 flex flex-col justify-center"
            >
              {/* Receipt Output Slot Simulation (Metallic Aluminum Printer Slot Frame) */}
              <div className="w-full h-3 bg-gradient-to-b from-stone-600 to-stone-800 rounded-t-lg shadow-inner relative z-20 border-b border-stone-900 flex items-center justify-center">
                <div className="w-[90%] h-0.5 bg-black rounded" />
              </div>

              {/* Physical Thermal Receipt Paper */}
              <div 
                id="interactive-thermal-receipt"
                className="relative bg-white text-stone-900 p-6 pt-8 pb-10 shadow-2xl flex flex-col transition-all"
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  clipPath: 'polygon(0% 8px, 2.5% 0px, 5% 8px, 7.5% 0px, 10% 8px, 12.5% 0px, 15% 8px, 17.5% 0px, 20% 8px, 22.5% 0px, 25% 8px, 27.5% 0px, 30% 8px, 32.5% 0px, 35% 8px, 37.5% 0px, 40% 8px, 42.5% 0px, 45% 8px, 47.5% 0px, 50% 8px, 52.5% 0px, 55% 8px, 57.5% 0px, 60% 8px, 62.5% 0px, 65% 8px, 67.5% 0px, 70% 8px, 72.5% 0px, 75% 8px, 77.5% 0px, 80% 8px, 82.5% 0px, 85% 8px, 87.5% 0px, 90% 8px, 92.5% 0px, 95% 8px, 97.5% 0px, 100% 8px, 100% calc(100% - 8px), 97.5% 100%, 95% calc(100% - 8px), 92.5% 100%, 90% calc(100% - 8px), 87.5% 100%, 85% calc(100% - 8px), 82.5% 100%, 80% calc(100% - 8px), 77.5% 100%, 75% calc(100% - 8px), 72.5% 100%, 70% calc(100% - 8px), 67.5% 100%, 65% calc(100% - 8px), 62.5% 100%, 60% calc(100% - 8px), 57.5% 100%, 55% calc(100% - 8px), 52.5% 100%, 50% calc(100% - 8px), 47.5% 100%, 45% calc(100% - 8px), 42.5% 100%, 40% calc(100% - 8px), 37.5% 100%, 35% calc(100% - 8px), 32.5% 100%, 30% calc(100% - 8px), 27.5% 100%, 25% calc(100% - 8px), 22.5% 100%, 20% calc(100% - 8px), 17.5% 100%, 15% calc(100% - 8px), 12.5% 100%, 10% calc(100% - 8px), 7.5% 100%, 5% calc(100% - 8px), 2.5% 100%, 0% calc(100% - 8px))',
                  backgroundImage: 'radial-gradient(circle at 50% 50%, #ffffff 0%, #fdfdfa 100%)'
                }}
              >
                {/* Simulated thermal heat stamp header brand */}
                <div className="text-center mb-3">
                  <div className="mx-auto h-8 w-8 rounded-lg bg-stone-900 text-white font-black text-sm flex items-center justify-center shadow-sm tracking-wider mb-2">DN</div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 m-0 leading-tight">DAILYNEST POS</h3>
                  <p className="text-[9px] text-stone-500 m-0 uppercase tracking-widest mt-0.5">High Speed Checkout System</p>
                  <p className="text-[9px] text-stone-500 m-0">Aalbot Retail Partners Inc.</p>
                  <p className="text-[8px] text-stone-400 m-0">Trivandrum City Circle, India</p>
                </div>

                {/* Divider */}
                <div className="border-t border-dashed border-stone-300 my-2.5" />

                {/* Administrative summary keys */}
                <div className="text-[9px] text-stone-600 space-y-0.5">
                  <div className="flex justify-between">
                    <span>INVOICE NO:</span>
                    <span className="font-bold text-stone-900">{activeReceipt.orderId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>DATE & TIME:</span>
                    <span>{activeReceipt.dateTimeString}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PAY METHOD:</span>
                    <span className="font-bold text-stone-900 uppercase">{activeReceipt.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>REGISTER:</span>
                    <span>TERM-03D (ONLINE)</span>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-dashed border-stone-300 my-2.5" />

                {/* Column Titles */}
                <div className="grid grid-cols-[1.8fr_0.6fr_1fr] text-[9px] font-bold text-stone-900 uppercase pb-1 border-b border-dotted border-stone-200">
                  <span>Item Name</span>
                  <span className="text-center">Qty</span>
                  <span className="text-right">Total</span>
                </div>

                {/* Item List */}
                <div className="space-y-1.5 py-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {activeReceipt.cart.map((item, idx) => {
                    const uniqueKey = `${item.id}_${item.vId || 'default'}_${idx}`;
                    return (
                      <div key={uniqueKey} className="grid grid-cols-[1.8fr_0.6fr_1fr] text-[10px] text-stone-800 leading-tight">
                        <div className="flex flex-col min-w-0 pr-1">
                          <span className="truncate font-medium">{item.name}</span>
                          {item.variantName && (
                            <span className="text-[8px] text-stone-400 font-bold tracking-wide uppercase">[{item.variantName}]</span>
                          )}
                        </div>
                        <span className="text-stone-550 text-center">{item.qty}</span>
                        <span className="text-right font-medium">₹{(item.price * item.qty).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Divider */}
                <div className="border-t-2 border-dotted border-stone-300 my-2" />

                {/* Financial Summary */}
                <div className="text-[10px] text-stone-700 space-y-1">
                  <div className="flex justify-between">
                    <span>SUBTOTAL:</span>
                    <span>₹{activeReceipt.totals.subtotal.toFixed(2)}</span>
                  </div>
                  {activeReceipt.totals.discount > 0 && (
                    <div className="flex justify-between text-rose-600 font-bold">
                      <span>SAVINGS DISCOUNT:</span>
                      <span>-₹{activeReceipt.totals.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>CGST/SGST TAX (INC):</span>
                    <span>₹{activeReceipt.totals.tax.toFixed(2)}</span>
                  </div>

                  {/* Grand total in solid box */}
                  <div className="flex justify-between font-black text-xs text-stone-900 bg-stone-100 border border-stone-200 py-1.5 px-2 rounded-md mt-2">
                    <span>NET TOTAL:</span>
                    <span>₹{activeReceipt.totals.grandTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* Return change details */}
                {activeReceipt.paymentMethod.toUpperCase() === 'CASH' ? (
                  <div className="my-2.5 p-2 bg-stone-50 border border-stone-200 rounded-md text-[9px] space-y-0.5 text-stone-600">
                    <div className="flex justify-between">
                      <span>CASH TENDED:</span>
                      <span className="font-bold text-stone-800">₹{activeReceipt.receivedAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-stone-200 pt-1 mt-1 font-bold">
                      <span className="text-stone-800 font-extrabold uppercase text-[7.5px] align-middle">CHANGE DUE:</span>
                      <span className="text-green-700 text-xs font-black">₹{activeReceipt.changeDue.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="my-2.5 p-2 bg-blue-50/55 border border-blue-100 rounded-md text-[8.5px] text-center text-blue-800 font-semibold leading-normal">
                    🟢 Secure UPI Mobile Verification Evidence Uploaded
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-dashed border-stone-300 my-2.5" />

                {/* Simulated dynamic 1D barcode */}
                <div className="flex flex-col items-center justify-center my-1 select-none">
                  <div className="w-[180px] h-8 flex" style={{
                    clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
                    background: 'repeating-linear-gradient(90deg, #0d0d0c 0px, #0d0d0c 1.5px, #fff 1.5px, #fff 3.5px, #0d0d0c 3.5px, #0d0d0c 5px, #fff 5px, #fff 6px, #0d0d0c 6px, #0d0d0c 8px, #fff 8px, #fff 10px)'
                  }} />
                  <span className="text-[7.5px] text-stone-400 font-mono font-bold mt-1 tracking-wider">*{activeReceipt.orderId}*</span>
                </div>

                {/* Footer text */}
                <div className="text-center text-[8px] text-stone-500 mt-2 space-y-0.5 leading-normal">
                  <div className="font-bold text-[9px] text-stone-800 uppercase tracking-widest">THANK YOU FOR YOUR VISIT!</div>
                  <div>Live Green. Please reuse this paperless log receipt.</div>
                  <div className="text-stone-400 font-mono tracking-wider flex items-center justify-center gap-1">
                    <span>POS_VER: 4.89</span> • <span>NODE_03D</span>
                  </div>
                </div>
              </div>

              {/* Extra Interactive Tools Station below the physical paper receipt */}
              <div className="space-y-2 mt-4 relative z-10 font-sans px-1">
                {/* Print and Start physical outputs */}
                <button
                  onClick={() => {
                    // Trigger download of the high-fidelity colored PDF receipt first
                    downloadReceiptAsFile();
                    // Trigger the standard browser print flow with a slight delay so they don't block each other
                    setTimeout(() => {
                      window.print();
                    }, 300);
                  }}
                  className="w-full h-11 text-xs font-bold uppercase tracking-wider rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/15 hover:shadow-blue-500/25 border border-blue-500/20 hover:border-blue-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  title="Print receipt and download high-quality copy"
                >
                  <Printer className="h-4 w-4" />
                  <span>Print Receipt & Save PDF</span>
                </button>

                {/* Proceed and Flush modal action */}
                <button
                  onClick={() => {
                    setActiveReceipt(null);
                    setSimulatedEmail('');
                    setSimulatedEmailBoxOpen(false);
                  }}
                  className="w-full h-11 text-xs font-bold uppercase tracking-widest rounded-xl bg-green-550 hover:bg-green-600 text-white transition-all hover:scale-[1.01] active:scale-98 cursor-pointer shadow-md shadow-green-500/10 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" /> Start New Checkout
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==========================================
          9. CONFIRMATION POPUP FOR PAYMENT OWNER SAVING
          ========================================== */}
      <AnimatePresence>
        {isSaveConfirmOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Dark glass cover background */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSaveConfirmOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-xs cursor-pointer"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className={`relative w-full max-w-sm rounded-3xl border p-6 shadow-2xl z-10 transition-colors ${
                isThemeLight ? 'bg-white border-stone-200 text-stone-900 shadow-xl' : 'bg-slate-900 border-slate-800 text-slate-100 shadow-2xl shadow-indigo-950/20'
              }`}
            >
              {/* Alert Sign Header */}
              <div className="flex items-center gap-3.5 mb-4 border-b pb-4 border-dashed border-stone-150 dark:border-slate-800/80 ">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs uppercase tracking-widest text-amber-500">Confirm Operation</h3>
                </div>
              </div>

              {/* Message */}
              <div className="space-y-4 text-xs leading-relaxed font-sans mb-6">
                <p className={isThemeLight ? 'text-stone-600' : 'text-slate-305'}>
                  Are you absolutely sure you want to save these updated payment credentials to the cloud database?
                </p>

                <div className={`p-3.5 rounded-xl border space-y-2.5 text-[11px] ${
                  isThemeLight ? 'bg-stone-50 border-stone-200' : 'bg-slate-950 border-slate-850'
                }`}>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-400 dark:text-gray-500 block">Proposed Name</span>
                    <span className="font-extrabold text-xs">{editOwnerName}</span>
                  </div>
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-400 dark:text-gray-500 block">Proposed UPI Address</span>
                    <span className="font-mono font-black text-rose-500 text-xs">{editOwnerUpi}</span>
                  </div>
                </div>

                <p className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                  * This will dynamically update all UPI payment screens and QR codes immediately.
                </p>
              </div>

              {/* Confirm Actions */}
              <div className="flex gap-2.5">
                <button
                  onClick={() => setIsSaveConfirmOpen(false)}
                  className={`flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-wider border transition-all active:scale-95 cursor-pointer ${
                    isThemeLight 
                      ? 'border-stone-200 hover:bg-stone-100 text-stone-500' 
                      : 'border-slate-800 hover:bg-slate-800 text-slate-400'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setIsSavingOwner(true);
                    try {
                      const ownerDocRef = doc(db, 'paymentowner', 'receiver_profile');
                      await setDoc(ownerDocRef, {
                        upiId: editOwnerUpi,
                        name: editOwnerName,
                        updatedAt: new Date().toISOString()
                      });
                      setPaymentOwnerUpi(editOwnerUpi);
                      setPaymentOwnerName(editOwnerName);
                      addToast("Payment owner profile updated successfully!", "success");
                      setIsSaveConfirmOpen(false);
                    } catch (err: any) {
                      console.error("Firestore save error:", err);
                      addToast(`Write secure failure: ${err.message || err}`, "warn");
                    } finally {
                      setIsSavingOwner(false);
                    }
                  }}
                  disabled={isSavingOwner}
                  className="flex-1 h-10 rounded-xl text-xs font-bold uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-md shadow-emerald-500/10"
                >
                  {isSavingOwner ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    "Yes, Save"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );

  // ==========================================
  // SHARED CHEKOUT BASKET MODULE DESIGN
  // ==========================================

  function renderCheckoutBasket(onCloseSidebarAction?: () => void) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        
        {/* Cart Header */}
        <div className={`p-4 px-6 border-b flex items-center justify-between shrink-0 transition-colors ${
          isThemeLight ? 'border-stone-200 bg-white' : 'border-gray-800/40 bg-slate-900/10'
        }`}>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4.5 w-4.5 text-blue-500" />
            <h3 className={`font-display text-sm font-bold uppercase tracking-wider ${
              isThemeLight ? 'text-stone-900' : 'text-white'
            }`}>Checkout Basket</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold border transition-colors ${
              isThemeLight 
                ? 'bg-blue-50 border-blue-200 text-blue-600' 
                : 'bg-blue-950/80 border-blue-900/30 text-blue-400'
            }`}>
              {totalQty} Items
            </span>
          </div>

          <div className="flex items-center gap-2">
            
            {/* Header clear icon */}
            <button
              onClick={forceClearBasket}
              disabled={cart.length === 0}
              className={`p-2 rounded-lg text-rose-500 hover:text-rose-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer ${
                isThemeLight ? 'bg-stone-100 hover:bg-stone-200/80' : 'bg-gray-900 hover:bg-gray-850'
              }`}
              title="Clear Active Invoice"
            >
              <Trash2 className="h-4.5 w-4.5" />
            </button>

            {/* mobile close icon drawer */}
            {onCloseSidebarAction && (
              <button
                onClick={onCloseSidebarAction}
                className={`md:hidden p-2 rounded-lg transition-colors cursor-pointer ${
                  isThemeLight ? 'bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900' : 'bg-gray-900 hover:bg-gray-850 text-gray-400 hover:text-white'
                }`}
              >
                <X className="h-4.5 w-4.5" />
              </button>
            )}

          </div>
        </div>

        {/* Current Order details reference banner */}
        <div className={`px-6 py-2 border-b flex justify-between items-center font-mono text-[10px] shrink-0 transition-colors ${
          isThemeLight ? 'bg-stone-100/80 border-stone-200/60 text-stone-500' : 'bg-slate-950/80 border-gray-800/20 text-gray-500'
        }`}>
          <span>Active Invoice ID: <span className={`font-bold ${isThemeLight ? 'text-stone-800' : 'text-gray-300'}`}>{orderId}</span></span>
          <span>Station Operator: #03</span>
        </div>

        {/* Cart items listing Area */}
        <div 
          className="flex-1 overflow-y-auto p-4 px-6 space-y-2"
          onScroll={dismissKeyboard}
          onTouchMove={dismissKeyboard}
        >
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-3 ${
                isThemeLight ? 'bg-stone-100' : 'bg-gray-900/40'
              }`}>
                <ShoppingCart className="h-5 w-5 text-gray-400" />
              </div>
              <span className={`font-display font-medium text-xs ${
                isThemeLight ? 'text-stone-600' : 'text-gray-400'
              }`}>Merchant basket is clean</span>
              <p className={`text-[10px] mt-0.5 leading-normal max-w-[180px] ${
                isThemeLight ? 'text-stone-400' : 'text-gray-600'
              }`}>Select description rows or triggers to build customer invoice lines.</p>
            </div>
          ) : (
            <AnimatePresence>
              {cart.map((item) => {
                const uniqueKey = `${item.id}_${item.vId}`;
                return (
                  <motion.div
                    key={uniqueKey}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                    className={`p-3 rounded-xl border shadow transition-all flex flex-col xs:flex-row xs:items-center justify-between gap-2.5 xs:gap-4 ${
                      isThemeLight 
                        ? 'border-stone-200 bg-white hover:border-stone-300' 
                        : 'border-gray-800/80 bg-gray-950/40 hover:border-gray-800'
                    }`}
                  >
                    {/* Item Information Block */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className={`text-xs font-bold leading-tight block truncate pr-1 ${
                            isThemeLight ? 'text-stone-900' : 'text-gray-200'
                          }`}>{item.name}</span>
                          {item.unitValue && (
                            <span className="text-[9px] uppercase font-bold text-blue-500 shrink-0 inline-block mt-0.5">({item.unitValue} {item.unit})</span>
                          )}
                        </div>
                        {/* Mobile Delete */}
                        <button
                          onClick={() => removeItemDirectly(uniqueKey)}
                          className="xs:hidden p-1 rounded text-rose-500 hover:text-rose-600 transition-colors cursor-pointer shrink-0"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Pricing block */}
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 font-mono text-[10px]">
                        <span className={isThemeLight ? 'text-stone-400' : 'text-gray-500'}>
                          M.R.P.: <span className="line-through">₹{item.mrp.toFixed(2)}</span>
                        </span>
                        <span className="text-green-600 font-bold">Offer: ₹{item.price.toFixed(2)}</span>
                        {item.tax > 0 && (
                          <span className={`text-[9px] px-1 rounded ${
                            isThemeLight ? 'text-stone-500 bg-stone-100' : 'text-gray-650 bg-gray-900'
                          }`}>GST {item.tax}%</span>
                        )}
                      </div>
                    </div>

                    {/* Quantity Controls & Dynamic totals (with mobile optimization) */}
                    <div className="flex items-center justify-between xs:justify-end gap-3 shrink-0 pt-2 xs:pt-0 border-t border-dashed border-stone-100 dark:border-gray-900/60 xs:border-t-0">
                      {/* Numeric operator adjustments */}
                      <div className={`flex items-center gap-2 border p-1 rounded-lg ${
                        isThemeLight ? 'bg-stone-50 border-stone-200' : 'bg-gray-900 border-gray-800'
                      }`}>
                        <button
                          onClick={() => addToCart(item, -1)}
                          className={`h-6 w-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                            isThemeLight ? 'text-stone-600 hover:text-stone-900 bg-stone-200/60' : 'text-gray-400 hover:text-white bg-gray-950'
                          }`}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className={`font-mono text-xs font-black w-5 text-center leading-none ${
                          isThemeLight ? 'text-stone-900' : 'text-white'
                        }`}>{item.qty}</span>
                        <button
                          onClick={() => addToCart(item, 1)}
                          className={`h-6 w-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                            isThemeLight ? 'text-stone-600 hover:text-stone-900 bg-stone-200/60' : 'text-gray-400 hover:text-white bg-gray-950'
                          }`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-col items-end shrink-0 min-w-[55px]">
                        <span className="text-[9px] uppercase tracking-wide text-gray-400 dark:text-gray-500 font-mono font-medium block xs:hidden">Total</span>
                        <span className={`font-mono text-xs font-black ${
                          isThemeLight ? 'text-stone-900' : 'text-gray-200'
                        }`}>₹{(item.price * item.qty).toFixed(2)}</span>
                      </div>

                      {/* Desktop Delete */}
                      <button
                        onClick={() => removeItemDirectly(uniqueKey)}
                        className="hidden xs:inline-block p-1 rounded text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Totalling area */}
        <div className={`p-4 px-6 border-t-2 shrink-0 space-y-2.5 transition-colors ${
          isThemeLight 
            ? 'border-stone-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.03)]' 
            : 'border-gray-800/60 bg-gray-950'
        }`}>
          <div className={`flex justify-between items-center text-xs font-semibold ${
            isThemeLight ? 'text-stone-500' : 'text-gray-500'
          }`}>
            <span>Gross Value:</span>
            <span className={`font-mono ${isThemeLight ? 'text-stone-800 font-bold' : 'text-gray-300'}`}>₹{purchaseTotals.subtotal.toFixed(2)}</span>
          </div>
          {purchaseTotals.discount > 0 && (
            <div className={`flex justify-between items-center text-xs font-bold ${
              isThemeLight ? 'text-rose-600' : 'text-rose-400'
            }`}>
              <span>Savings Discount:</span>
              <span className="font-mono">-₹{purchaseTotals.discount.toFixed(2)}</span>
            </div>
          )}
          <div className={`flex justify-between items-center text-xs font-semibold ${
            isThemeLight ? 'text-stone-500' : 'text-gray-500'
          }`}>
            <span>Tax (VAT/CGST Included):</span>
            <span className={`font-mono ${isThemeLight ? 'text-stone-700' : 'text-gray-400'}`}>₹{purchaseTotals.tax.toFixed(2)}</span>
          </div>

          <div className={`pt-3 border-t mt-1 flex justify-between items-center ${
            isThemeLight ? 'border-stone-200' : 'border-gray-800/80'
          }`}>
            <span className={`font-display font-bold text-sm uppercase tracking-widest ${
              isThemeLight ? 'text-stone-800' : 'text-gray-100'
            }`}>Amount Due</span>
            <span className="font-mono text-2xl font-black text-green-600">₹{purchaseTotals.grandTotal.toFixed(2)}</span>
          </div>

          {/* Core trading CTA bars */}
          <div className="pt-4 flex items-center gap-3">
            <button
              onClick={holdActiveTransaction}
              className={`h-12 flex-[0_0_35%] rounded-xl border transition-all font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                isThemeLight
                  ? 'border-stone-300 bg-stone-50 text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                  : 'border-gray-800 bg-transparent text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
            >
              <Pause className="h-4 w-4" /> Suspension
            </button>
            <button
              onClick={launchPaymentReceiptProcessor}
              disabled={cart.length === 0}
              className="h-12 flex-1 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-extrabold transition-all shadow-md shadow-blue-500/20 hover:scale-103 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none cursor-pointer flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
            >
              Settle payment <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

      </div>
    );
  }
}
