import "./App.css";

import React, {
  lazy,
  Suspense,
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode, type JSX,
} from "react";

import { useDispatch, useSelector } from "react-redux";
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useNavigate } from "react-router-dom";

import type { MenuItem } from "./entities/entities";
import type { RootState, AppDispatch } from "./store/store";

import FoodOrder from "./components/FoodOrder";
import ErrorBoundary from "./components/ErrorBoundary";
import logger from "./services/logging";

import { AuthProvider, AuthContext } from "./contexts/AuthContext";
import authService from "./services/AuthService";
import { Role } from "./services/IAuthService";

import {
  togglePage,
  selectFood,
  orderFood as orderFoodAction,
  removeFromCart,
  startOrdersSubscription,
  stopOrdersSubscription,
  markOrderPaid,
  deleteOrder,
} from "./store/foodSlice";

// AC 5.1 - Carga Diferida (Lazy) para Foods
const Foods = lazy(() => import("./components/Foods"));

export interface FoodAppContextType {
  orderFood: (food: MenuItem, quantity: number) => void;
}

export const foodAppContext = createContext<FoodAppContextType | null>(null);

interface ProtectedRouteProps {
  children: JSX.Element;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user } = useContext(AuthContext);
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

interface AdminRouteProps {
  children: ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, roles } = useContext(AuthContext);

  // AC 8.1 Access only if user != null and roles include ADMIN
  if (!user || !roles || !roles.includes(Role.ADMIN)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const Navbar: React.FC = () => {
  const { user, roles } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authService.signOut();
      navigate("/login");
    } catch (error) {
      console.error("Error al cerrar sesión", error);
    }
  };

  return (
      <nav className="navbar">
        <ul className="nav-menu">
          <li>
            <Link to="/">Home</Link>
          </li>

          {user && (
              <li>
                <Link to="/dashboard">Dashboard</Link>
              </li>
          )}

          {user && roles && roles.includes(Role.ADMIN) && (
              <li>
                <Link to="/admin">Admin</Link>
              </li>
          )}

          {!user && (
              <li>
                <Link to="/login">Login</Link>
              </li>
          )}

          {!user && (
              <li>
                <Link to="/register">Registro</Link>
              </li>
          )}

          {user && (
              <li>
                <button onClick={handleLogout}>Logout</button>
              </li>
          )}
        </ul>
      </nav>
  );
};

const Home: React.FC = () => {
  const { user, roles } = useContext(AuthContext);

  return (
      <div className="main-content">
        <h3 className="title">Comida Rapida Online</h3>

        {!user && (
            <p>
              Para hacer pedidos, inicia sesión (Login) o regístrate (Registro).
            </p>
        )}

        {user && (
            <p>
              Sesión iniciada como: {user.email ?? "(sin email)"}{" "}
              {roles && roles.includes(Role.ADMIN) ? "(ADMIN)" : ""}
            </p>
        )}

        <p>
          Links: <Link to="/dashboard">Dashboard</Link> | <Link to="/admin">Admin</Link>
        </p>
      </div>
  );
};

const Login: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");

  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    try {
      const userCredential = await authService.signIn(email, password);
      console.log("Usuario autenticado", userCredential.user);
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Error al iniciar sesión", err);
      setError(err?.message ?? "Error");
    }
  };

  return (
      <div className="main-content">
        <form onSubmit={handleLogin}>
          <h2>Iniciar Sesión</h2>

          <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
          />

          <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit">Login</button>

          {error && <p className="error-message">{error}</p>}
        </form>
      </div>
  );
};

const Register: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const userCredential = await authService.signUp(email, password);
      console.log("Usuario registrado", userCredential.user);

      setSuccess("Registro exitoso. Redirigiendo al Dashboard...");

      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (err: any) {
      console.error("Error al registrarse", err);
      setError(err?.message ?? "Error");
    }
  };

  return (
      <div className="main-content">
        <form onSubmit={handleRegister}>
          <h2>Registrarse</h2>

          <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
          />

          <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
          />

          <button type="submit">Registrarse</button>

          {error && <p className="error-message">{error}</p>}
          {success && <p className="success-message">{success}</p>}
        </form>
      </div>
  );
};

/* Dashboard = "hacer pedidos" (only auth) */
const Dashboard: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user } = useContext(AuthContext);

  const isChooseFoodPage = useSelector((s: RootState) => s.food.isChooseFoodPage);
  const menuItems = useSelector((s: RootState) => s.food.menuItems);
  const selectedFood = useSelector((s: RootState) => s.food.selectedFood);

  const cartItems = useSelector((s: RootState) => s.food.cartItems);
  const cartTotal = cartItems.reduce((sum, c) => sum + c.price * c.quantity, 0);

  const orders = useSelector((s: RootState) => s.food.orders);
  const ordersLoading = useSelector((s: RootState) => s.food.ordersLoading);
  const ordersError = useSelector((s: RootState) => s.food.ordersError);

  const statusMessage = useSelector((s: RootState) => s.food.statusMessage);

  useEffect(() => {
    if (!user) return;

    dispatch(startOrdersSubscription());

    return () => {
      dispatch(stopOrdersSubscription());
    };
  }, [dispatch, user]);

  const orderFood: FoodAppContextType["orderFood"] = (food, quantity) => {
    dispatch(orderFoodAction({ food, quantity }));
  };

  return (
      <foodAppContext.Provider value={{ orderFood }}>
        <div className="App">
          <button
              className="toggleButton"
              onClick={() => {
                logger.info(`UI: toggle page; current=${isChooseFoodPage ? "ORDER" : "STOCK"}`);
                dispatch(togglePage());
              }}
          >
            {isChooseFoodPage ? "Disponibilidad" : "Pedir Comida"}
          </button>

          <h3 className="title">Comida Rapida Online</h3>

          {statusMessage && <p className="statusMessage">{statusMessage}</p>}

          {isChooseFoodPage && (
              <>
                {selectedFood === undefined ? (
                    <Suspense fallback={<div>Cargando detalles ......</div>}>
                      <Foods
                          foodItems={menuItems}
                          onFoodSelected={(food) => {
                            logger.info(`UI: food selected; id=${food.id}, name=${food.name}`);
                            dispatch(selectFood(food));
                          }}
                      />
                    </Suspense>
                ) : (
                    <FoodOrder
                        food={selectedFood}
                        onReturnToMenu={() => {
                          logger.debug("UI: return to menu");
                          dispatch(selectFood(undefined));
                        }}
                    />
                )}
              </>
          )}

          <div className="cartBox">
            <h4 className="subTitle">Carrito</h4>

            {cartItems.length === 0 ? (
                <p className="cartEmpty">Carrito vacío</p>
            ) : (
                <>
                  <ul className="ulCart">
                    {cartItems.map((c) => (
                        <li key={c.id} className="liCart">
                    <span>
                      {c.name} x{c.quantity}
                    </span>
                          <span>{c.price * c.quantity}$</span>
                          <button onClick={() => dispatch(removeFromCart({ id: c.id }))}>Quitar</button>
                        </li>
                    ))}
                  </ul>

                  <p className="cartTotal">Total: {cartTotal}$</p>
                </>
            )}
          </div>

          <div className="ordersBox">
            <h4 className="subTitle">Pedidos (Firebase)</h4>

            {ordersLoading && <p>Cargando pedidos...</p>}
            {ordersError && <p>Error cargando pedidos: {ordersError}</p>}
            {!ordersLoading && !ordersError && orders.length === 0 && <p>No hay pedidos.</p>}

            {!ordersLoading && !ordersError && orders.length > 0 && (
                <ul className="ulOrders">
                  {orders.map((o) => (
                      <li key={o.id} className="liOrders">
                  <span>
                    #{o.id} — {o.status} — {o.total}$
                  </span>

                        <button onClick={() => dispatch(markOrderPaid({ id: o.id }))}>
                          Marcar pagado
                        </button>

                        <button onClick={() => dispatch(deleteOrder({ id: o.id }))}>Borrar</button>
                      </li>
                  ))}
                </ul>
            )}
          </div>
        </div>
      </foodAppContext.Provider>
  );
};

//AC 8.1 Admin = "visualizar stock" (only ADMIN)
const AdminPanel: React.FC = () => {
  const menuItems = useSelector((s: RootState) => s.food.menuItems);

  return (
      <div className="main-content">
        <h2>Administración</h2>
        <h4 className="subTitle">Stock</h4>

        <ul className="ulApp">
          {menuItems.map((item) => (
              <li key={item.id} className="liApp">
                <p>{item.name}</p>
                <p>#{item.quantity}</p>
              </li>
          ))}
        </ul>
      </div>
  );
};

function App() {
  return (
      <ErrorBoundary fallback={<div>Algo salió mal!</div>}>
        <AuthProvider>
          <Router>
            <Navbar />

            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
              />

              <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminPanel />
                    </AdminRoute>
                  }
              />
            </Routes>
          </Router>
        </AuthProvider>
      </ErrorBoundary>
  );
}

export default App;
