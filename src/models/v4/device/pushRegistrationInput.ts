export class PushRegistrationInput {
  public UserId: string = '';
  public Token: string = '';
  public Platform: number = 0;
  public DeviceUuid: string = '';
  public Prefix: string = '';
  /** Source app marker ("IC") — routes the Novu credential update to the IC-specific subscriber. */
  public Source: string = '';
}
