interface IState {
    fromState?: IState;
    enter(opts: any): Promise<void>;
    exit(): Promise<void>;
}
export default IState;
