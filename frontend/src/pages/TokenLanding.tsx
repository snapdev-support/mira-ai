import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export default function TokenLanding() {
  const navigate = useNavigate();
  const { jti } = useParams();
  const location = useLocation();

  useEffect(() => {
    // Preserve the exact scanned token (current URL) for verification.
    const token = window.location.href;
    const qp = new URLSearchParams();
    qp.set("token", token);
    if (jti) qp.set("jti", jti);
    navigate(`/verify?${qp.toString()}`, { replace: true, state: { from: location.pathname } });
  }, [jti, location.pathname, navigate]);

  return null;
}
