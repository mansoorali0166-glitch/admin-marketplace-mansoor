import React, { useEffect, useState } from "react";
import "./SellerRecharge.css";

const presets = [100, 300, 500, 1000, 2000, 5000];

export default function SellerRecharge({ client, sellerId, onBack }) {
  const [showRequest, setShowRequest] = useState(false);
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState("");
  const [records, setRecords] = useState([]);

  const loadRecords = async () => {
    if (!client || !sellerId) return;
    const { data } = await client
      .from("recharge_requests")
      .select("*")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false });
    setRecords(
      (data || []).map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        status: row.status,
        date: new Date(row.created_at).toLocaleString(),
      })),
    );
  };

  useEffect(() => {
    loadRecords();
    if (!client) return;
    const channel = client
      .channel("seller-recharge-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recharge_requests" },
        loadRecords,
      )
      .subscribe();
    return () => client.removeChannel(channel);
  }, [client, sellerId]);

  const closeRequest = () => {
    setShowRequest(false);
    setStep(1);
  };
  const submitRecharge = async () => {
    if (client && sellerId)
      await client
        .from("recharge_requests")
        .insert({
          seller_id: sellerId,
          amount: Number(amount),
          status: "Pending",
        });
    setAmount("");
    closeRequest();
  };

  return (
    <main className="seller-recharge-page">
      <div className="seller-recharge-shell">
        <header>
          <button type="button" onClick={onBack}>
            ‹
          </button>
          <h1>Recharge</h1>
          <span />
        </header>
        <button
          type="button"
          className="request-recharge-btn"
          onClick={() => setShowRequest(true)}
        >
          ＋ Request Recharge
        </button>
        <section className="recharge-history">
          <h2>RECHARGE HISTORY</h2>
          {records.length === 0 ? (
            <div className="recharge-empty">
              <div>▤</div>
              <p>No recharge records yet</p>
            </div>
          ) : (
            <div className="recharge-records">
              {records.map((record) => (
                <article key={record.id}>
                  <div>
                    <strong>${record.amount.toFixed(2)}</strong>
                    <time>{record.date}</time>
                  </div>
                  <span>{record.status}</span>
                </article>
              ))}
            </div>
          )}
        </section>
        {showRequest && (
          <div
            className="recharge-sheet-overlay"
            onMouseDown={(event) =>
              event.target === event.currentTarget && closeRequest()
            }
          >
            <form
              className="recharge-sheet"
              onSubmit={(event) => {
                event.preventDefault();
                if (step === 1) setStep(2);
                else submitRecharge();
              }}
            >
              <div className="sheet-handle" />
              <div className="recharge-steps">
                <b className="active">1</b>
                <span />
                <b className={step === 2 ? "active" : ""}>2</b>
              </div>
              {step === 1 ? (
                <>
                  <h2>Enter Amount</h2>
                  <p>How much would you like to recharge?</p>
                  <label>
                    Amount (USD) *
                    <div>
                      <span>$</span>
                      <input
                        autoFocus
                        required
                        min="1"
                        step="0.01"
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                      />
                    </div>
                  </label>
                  <div className="recharge-presets">
                    {presets.map((value) => (
                      <button
                        type="button"
                        key={value}
                        onClick={() => setAmount(String(value))}
                      >
                        ${value}
                      </button>
                    ))}
                  </div>
                  <button
                    className="recharge-continue"
                    type="submit"
                    disabled={!amount || Number(amount) <= 0}
                  >
                    Continue　›
                  </button>
                </>
              ) : (
                <>
                  <h2>Confirm Request</h2>
                  <p>Review your recharge request before submitting.</p>
                  <div className="recharge-confirm-amount">
                    <span>Recharge Amount</span>
                    <strong>${Number(amount).toFixed(2)}</strong>
                    <small>
                      Status will be pending until approved by an administrator.
                    </small>
                  </div>
                  <div className="recharge-confirm-actions">
                    <button type="button" onClick={() => setStep(1)}>
                      Back
                    </button>
                    <button type="submit">Submit Request</button>
                  </div>
                </>
              )}
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
