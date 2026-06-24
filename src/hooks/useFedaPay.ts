'use client'

export function useFedaPay() {
  function openPayment(paymentUrl: string) {
    window.open(paymentUrl, '_blank', 'noopener,noreferrer')
  }

  return { openPayment }
}
