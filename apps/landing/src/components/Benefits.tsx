/** Guardnet-style three cards: text / video / text on neutral-950 with blurred blobs. */
const LOOP =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261022_235442_c62146c2-3f2f-46c0-ab51-649a4aa26cf5.mp4";

export function Benefits() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:py-32">
      <h2 className="display text-center text-3xl sm:text-5xl">The joke has rules</h2>
      <p className="mx-auto mt-4 max-w-xl text-center text-muted">
        Everything that matters lives in the contract, fixed at launch, readable by anyone.
      </p>
      <div className="mt-14 grid gap-3 sm:gap-4 md:grid-cols-3">
        <article className="relative h-[380px] sm:h-[460px] overflow-hidden rounded-3xl bg-neutral-950 p-7 sm:p-8">
          <div
            className="absolute top-1/2 -left-[420px] h-[460px] w-[460px] -translate-y-1/2 rounded-full bg-lime/40 blur-3xl opacity-40"
            aria-hidden
          />
          <div className="relative z-10 flex h-full flex-col">
            <h3 className="text-xl sm:text-2xl font-light leading-tight">
              Principal stays
              <br />
              yours. Always.
            </h3>
            <p className="mt-12 sm:mt-20 max-w-[280px] text-[13px] sm:text-sm leading-relaxed text-white/70 font-light">
              Your NEAR is staked with Meta Pool and booked at face value. Withdraw any time as
              stNEAR with no fee, or as NEAR through the liquid-unstake pool. The treasury never
              touches it.
            </p>
          </div>
        </article>
        <article className="relative flex h-[380px] sm:h-[460px] flex-col overflow-hidden rounded-3xl bg-neutral-950">
          <div className="relative w-full overflow-hidden" style={{ height: "75%" }}>
            <video
              className="block h-full w-full object-cover"
              src={LOOP}
              autoPlay
              loop
              muted
              playsInline
              aria-hidden
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-neutral-950" />
          </div>
          <div className="flex flex-1 items-center p-7 sm:p-8">
            <h3 className="text-xl sm:text-2xl font-light leading-tight">
              Only yield
              <br />
              is ever at play.
            </h3>
          </div>
        </article>
        <article className="relative h-[380px] sm:h-[460px] overflow-hidden rounded-3xl bg-neutral-950 p-7 sm:p-8">
          <div
            className="absolute -top-28 -right-28 h-56 w-56 rounded-full bg-pink/50 blur-3xl opacity-40"
            aria-hidden
          />
          <div className="relative z-10 flex h-full flex-col">
            <h3 className="text-xl sm:text-2xl font-light leading-tight">
              A floor that
              <br />
              cannot be zero.
            </h3>
            <p className="mt-auto max-w-[320px] text-[13px] sm:text-sm leading-relaxed text-white/70 font-light">
              Every token is redeemable for its share of the treasury. The treasury only receives
              staking yield, so floor = treasury ÷ supply and it is backed from day one.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
